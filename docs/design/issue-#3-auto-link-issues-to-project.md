# Design Document: Auto Link Issues to Project

**Issue**: #3 - Add GitHub Actions workflow to automatically link Issues to Project
**Author**: Claude
**Date**: 2026-01-05
**Status**: Draft

## Overview

This document describes the architecture and design for implementing automatic Issue-to-Project linking via GitHub Actions.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GitHub Repository                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐     ┌────────────────────────────────────────────┐    │
│  │  Issue Created   │────▶│  GitHub Actions Workflow                   │    │
│  │  (trigger)       │     │  (.github/workflows/issue-to-project.yml)  │    │
│  └──────────────────┘     └────────────────────────────────────────────┘    │
│                                        │                                     │
│                                        ▼                                     │
│                           ┌────────────────────────┐                        │
│                           │  Read Configuration    │                        │
│                           │  (.github/project.toml)│                        │
│                           └────────────────────────┘                        │
│                                        │                                     │
│                                        ▼                                     │
│                           ┌────────────────────────┐                        │
│                           │  GitHub GraphQL API    │                        │
│                           │  - Add to Project      │                        │
│                           │  - Set Field Values    │                        │
│                           └────────────────────────┘                        │
│                                        │                                     │
│                      ┌─────────────────┴─────────────────┐                  │
│                      ▼                                   ▼                   │
│           ┌──────────────────┐                ┌──────────────────┐          │
│           │  Success         │                │  Failure         │          │
│           │  (Issue added)   │                │  (Comment error) │          │
│           └──────────────────┘                └──────────────────┘          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLI Setup Tool                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────┐     ┌────────────────────────────────────┐    │
│  │  deno task setup:actions │────▶│  src/cli/commands/setup-actions.ts │    │
│  └──────────────────────────┘     └────────────────────────────────────┘    │
│                                              │                               │
│                      ┌───────────────────────┼───────────────────────┐      │
│                      ▼                       ▼                       ▼       │
│           ┌──────────────────┐    ┌──────────────────┐    ┌─────────────┐   │
│           │  Copy workflow   │    │  Create project  │    │  Update     │   │
│           │  template        │    │  config template │    │  .gitignore │   │
│           └──────────────────┘    └──────────────────┘    └─────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Configuration File (`.github/project.toml`)

TOML configuration file that defines the target project and default field values.

#### Schema

```toml
[project]
# Project URL (required)
url = "https://github.com/users/{owner}/projects/{number}"

[defaults]
# Status field - Optional
# Values: "Planned" | "Ready" | "In Progress" | "In Review" | "Done"
status = "Planned"

# Priority field - Optional
# Values: "P0" | "P1" | "P2"
priority = "P1"

# Iteration field - Optional
# Type: string (Sprint name)
# iteration = "Sprint 1"

# Size field - Optional
# Type: number
# size = 3

# Estimate field - Optional
# Type: number
# estimate = 5

# Start date - Optional
# Type: date (YYYY-MM-DD)
# start_date = "2026-01-05"

# Target date - Optional
# Type: date (YYYY-MM-DD)
# target_date = "2026-01-12"
```

### 2. GitHub Actions Workflow

Location: `.github/workflows/issue-to-project.yml`

#### Trigger

```yaml
on:
  issues:
    types: [opened]
```

#### Workflow Steps

1. **Checkout repository** - Access to project.toml
2. **Parse TOML configuration** - Extract project URL and defaults
3. **Extract Project ID** - Parse from URL or query via GraphQL
4. **Add Issue to Project** - GraphQL mutation `addProjectV2ItemById`
5. **Set field values** - GraphQL mutation `updateProjectV2ItemFieldValue`
6. **Error handling** - Comment on Issue if any step fails

### 3. CLI Setup Command

Location: `src/cli/commands/setup-actions.ts`

#### Interface

```typescript
interface SetupActionsOptions {
  /** Force overwrite existing files */
  force?: boolean;
  /** Project URL to pre-configure */
  projectUrl?: string;
}
```

#### Functionality

1. Create `.github/workflows/` directory if not exists
2. Copy workflow template to `.github/workflows/issue-to-project.yml`
3. Create `.github/project.toml` with default template
4. Display setup instructions (PAT requirements, secret setup)

## Type Definitions

### ProjectConfig (`src/types/project-config.ts`)

```typescript
/**
 * GitHub Project field value types
 */
export type StatusValue = 'Planned' | 'Ready' | 'In Progress' | 'In Review' | 'Done';
export type PriorityValue = 'P0' | 'P1' | 'P2';

/**
 * Project configuration defaults
 */
export interface ProjectDefaults {
  /** Status field initial value */
  status?: StatusValue;
  /** Priority field initial value */
  priority?: PriorityValue;
  /** Iteration/Sprint name */
  iteration?: string;
  /** Size estimate */
  size?: number;
  /** Time estimate */
  estimate?: number;
  /** Start date (YYYY-MM-DD) */
  startDate?: string;
  /** Target date (YYYY-MM-DD) */
  targetDate?: string;
}

/**
 * Project configuration
 */
export interface ProjectConfig {
  /** Project section */
  project: {
    /** GitHub Project URL */
    url: string;
  };
  /** Default field values */
  defaults?: ProjectDefaults;
}
```

## GraphQL Queries

### Get Project ID from URL

```graphql
query GetProjectId($owner: String!, $number: Int!) {
  user(login: $owner) {
    projectV2(number: $number) {
      id
      title
      fields(first: 20) {
        nodes {
          ... on ProjectV2Field {
            id
            name
          }
          ... on ProjectV2SingleSelectField {
            id
            name
            options {
              id
              name
            }
          }
          ... on ProjectV2IterationField {
            id
            name
            configuration {
              iterations {
                id
                title
              }
            }
          }
        }
      }
    }
  }
}
```

### Add Issue to Project

```graphql
mutation AddToProject($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
    item {
      id
    }
  }
}
```

### Update Field Value

```graphql
mutation UpdateField($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
  updateProjectV2ItemFieldValue(
    input: {projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value}
  ) {
    projectV2Item {
      id
    }
  }
}
```

## File Structure

```
.github/
├── project.toml                    # Project configuration
└── workflows/
    └── issue-to-project.yml        # GitHub Actions workflow

src/
├── cli/
│   └── commands/
│       └── setup-actions.ts        # CLI setup command
├── templates/
│   ├── issue-to-project.yml        # Workflow template
│   └── project.toml                # Config template
└── types/
    └── project-config.ts           # Type definitions
```

## Security Considerations

### Token Permissions

The `PROJECT_TOKEN` (Personal Access Token) requires:

- `project` scope - Full control of projects (read/write)
- `repo` scope - Repository access for Issue comments

### Secret Management

- PAT stored as repository secret: `PROJECT_TOKEN`
- Never expose token in logs or error messages
- Use minimal required permissions

## Error Handling Strategy

| Error Type          | Action                                |
| ------------------- | ------------------------------------- |
| Missing config file | Fail workflow, log error              |
| Invalid TOML syntax | Fail workflow, comment on Issue       |
| Project not found   | Fail workflow, comment on Issue       |
| Permission denied   | Fail workflow, comment on Issue       |
| Field not found     | Log warning, continue without setting |
| Network error       | Retry with backoff, then fail         |

### Error Comment Format

```markdown
:warning: **Failed to add this issue to the project**

**Error**: [Error message]

**Troubleshooting**:

- Ensure `PROJECT_TOKEN` secret is configured
- Verify the project URL in `.github/project.toml`
- Check that the token has `project` scope

[View workflow run](link-to-run)
```

## Dependencies

### Deno Standard Library

- `@std/toml` - TOML parsing (add to imports)

### External Actions (Workflow)

- `actions/checkout@v4` - Repository checkout
- `actions/github-script@v7` - GraphQL execution

## Testing Strategy

1. **Unit Tests**
   - TOML config parsing
   - URL parsing (extract owner/number)
   - Type validation

2. **Integration Tests**
   - CLI setup command (file creation)
   - Workflow syntax validation

3. **Manual Testing**
   - Create test Issue
   - Verify Project linkage
   - Test error scenarios

## Rollback Plan

If issues occur after deployment:

1. Delete `.github/workflows/issue-to-project.yml`
2. Workflow will no longer trigger
3. Existing Issues remain unaffected
