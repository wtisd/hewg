# Design Document: PR Status Update Workflow

**Issue**: #5 - Add GitHub Actions workflow to update Issue status to In Review on PR creation
**Author**: Claude
**Date**: 2026-01-05
**Status**: Draft

## Overview

This document describes the architecture and design for implementing automatic Issue status updates when a Pull Request is created or reopened. The workflow will change linked Issue statuses to "In Review" in the associated GitHub Project.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GitHub Repository                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐     ┌────────────────────────────────────────────┐    │
│  │  PR opened/      │────▶│  GitHub Actions Workflow                   │    │
│  │  reopened        │     │  (.github/workflows/pr-status-update.yml)  │    │
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
│                           │  Extract Issue Numbers │                        │
│                           │  - Branch name pattern │                        │
│                           │  - PR body keywords    │                        │
│                           └────────────────────────┘                        │
│                                        │                                     │
│                      ┌─────────────────┴─────────────────┐                  │
│                      ▼                                   ▼                   │
│           ┌──────────────────┐                ┌──────────────────┐          │
│           │  Issue in        │                │  Issue NOT in    │          │
│           │  Project         │                │  Project         │          │
│           └────────┬─────────┘                └────────┬─────────┘          │
│                    │                                   │                     │
│                    │                          ┌────────▼─────────┐          │
│                    │                          │  Auto-add Issue  │          │
│                    │                          │  to Project      │          │
│                    │                          └────────┬─────────┘          │
│                    └──────────────┬────────────────────┘                    │
│                                   ▼                                          │
│                      ┌────────────────────────┐                             │
│                      │  Update Status to      │                             │
│                      │  "In Review"           │                             │
│                      └────────────────────────┘                             │
│                                   │                                          │
│                      ┌────────────┴────────────┐                            │
│                      ▼                         ▼                             │
│           ┌──────────────────┐      ┌──────────────────┐                    │
│           │  Success         │      │  Failure         │                    │
│           │  (Status updated)│      │  (Comment on PR) │                    │
│           └──────────────────┘      └──────────────────┘                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Issue Number Extraction

Two methods for extracting Issue numbers from a Pull Request:

#### Branch Name Pattern

Branch format: `label/author/{issue_number}/title`

Examples:
- `feature/wtisd/123/add-login` → Issue #123
- `bugfix/john/456/fix-memory-leak` → Issue #456

Regex pattern: `^[^/]+/[^/]+/(\d+)/.*$`

#### PR Body Keywords

Supported keywords (case-insensitive):
- `Closes #N`
- `Fixes #N`
- `Resolves #N`
- `Close #N`
- `Fix #N`
- `Resolve #N`

Regex pattern: `(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)`

### 2. Configuration Extension (`.github/project.toml`)

New `[pr]` section to configure PR-related behavior:

```toml
[pr]
# Status to set when PR is opened/reopened
review_status = "In Review"

# Branch name pattern for Issue number extraction
# Matches: label/author/{issue_number}/title
branch_pattern = "^[^/]+/[^/]+/(\\d+)/.*$"

# Whether to ignore Draft PRs
ignore_draft = false
```

### 3. GitHub Actions Workflow

Location: `.github/workflows/pr-status-update.yml`

#### Trigger

```yaml
on:
  pull_request:
    types: [opened, reopened]
```

#### Workflow Steps

1. **Check Draft PR** - Skip if `ignore_draft` is true and PR is draft
2. **Checkout repository** - Access to project.toml
3. **Parse TOML configuration** - Extract project URL and PR settings
4. **Extract Issue numbers** - From branch name and PR body
5. **For each Issue**:
   a. Check if Issue exists in Project
   b. If not, add Issue to Project
   c. Update Status field to configured value
6. **Error handling** - Comment on PR if any step fails

## Type Definitions

### Extended ProjectConfig

```typescript
/**
 * PR-related configuration
 */
export interface PrConfig {
  /** Status to set when PR is opened/reopened */
  reviewStatus?: string;
  /** Regex pattern for extracting Issue number from branch name */
  branchPattern?: string;
  /** Whether to ignore Draft PRs */
  ignoreDraft?: boolean;
}

/**
 * Extended Project configuration
 */
export interface ProjectConfig {
  /** Project section */
  project: {
    /** GitHub Project URL */
    url: string;
  };
  /** Default field values for new issues */
  defaults?: ProjectDefaults;
  /** PR-related configuration */
  pr?: PrConfig;
}
```

## GraphQL Operations

### Get Project Item by Issue

```graphql
query GetProjectItem($projectId: ID!, $issueId: ID!) {
  node(id: $projectId) {
    ... on ProjectV2 {
      items(first: 100) {
        nodes {
          id
          content {
            ... on Issue {
              id
            }
          }
        }
      }
    }
  }
}
```

### Add Issue to Project (reuse from issue-to-project)

```graphql
mutation AddToProject($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
    item {
      id
    }
  }
}
```

### Update Status Field (reuse from issue-to-project)

```graphql
mutation UpdateField($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: String!) {
  updateProjectV2ItemFieldValue(
    input: {projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: {singleSelectOptionId: $value}}
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
├── project.toml                    # Project configuration (extended)
└── workflows/
    ├── issue-to-project.yml        # Existing: Issue creation workflow
    └── pr-status-update.yml        # New: PR status update workflow

src/
├── templates/
│   ├── issue-to-project.yml        # Existing template
│   ├── pr-status-update.yml        # New template
│   └── project.toml                # Updated config template
└── types/
    └── project-config.ts           # Extended type definitions
```

## Error Handling Strategy

| Error Type              | Action                                         |
| ----------------------- | ---------------------------------------------- |
| No Issue number found   | Comment on PR with warning                     |
| Issue not found         | Skip Issue, log warning                        |
| Project not found       | Comment on PR with error                       |
| Status option not found | Comment on PR with error                       |
| Permission denied       | Comment on PR with error                       |
| Network error           | Retry with backoff, then fail                  |

### Error Comment Format

```markdown
:warning: **Failed to update Issue status**

**Error**: [Error message]

**Issues processed**: #123, #456
**Issues failed**: #789

**Troubleshooting**:
- Ensure `PROJECT_TOKEN` secret is configured with `project` scope
- Verify the project URL in `.github/project.toml`
- Check that the status option exists in your project

[View workflow run](link-to-run)
```

### Warning Comment Format (No Issue Found)

```markdown
:information_source: **No linked Issues found**

Could not find Issue numbers in:
- Branch name: `feature/wtisd/no-issue/some-title`
- PR body keywords: (none found)

**Expected formats**:
- Branch: `label/author/{issue_number}/title`
- Keywords: `Closes #N`, `Fixes #N`, `Resolves #N`
```

## Security Considerations

### Token Permissions

Uses the same `PROJECT_TOKEN` as issue-to-project workflow:
- `project` scope - Full control of projects (read/write)
- `repo` scope - Repository access for PR comments

### Data Validation

- Validate Issue numbers are positive integers
- Sanitize all user input before using in GraphQL queries
- Limit number of Issues processed per PR (configurable, default: 10)

## Testing Strategy

1. **Unit Tests**
   - Branch name pattern matching
   - PR body keyword extraction
   - Multiple Issue number handling

2. **Integration Tests**
   - CLI setup command (new template deployment)
   - Workflow syntax validation

3. **Manual Testing**
   - Create PR with Issue in branch name
   - Create PR with keyword in body
   - Test Draft PR handling
   - Test Issue not in Project (auto-add)
   - Test error scenarios

## Rollback Plan

If issues occur after deployment:

1. Delete `.github/workflows/pr-status-update.yml`
2. Workflow will no longer trigger
3. Existing PRs and Issues remain unaffected
4. Can re-deploy after fixing issues
