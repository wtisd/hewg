# Design Document: Refactor Workflow CLI Commands

**Issue**: #13
**Date**: 2026-01-07
**Status**: Draft

## Overview

This document describes the architecture and design for refactoring `issue-to-project.yml` and `pr-status-update.yml` workflow files to use hewg CLI commands (`link-issue`, `pr-status`) instead of embedded JavaScript.

## Goals

1. Move business logic from GitHub Actions workflows to hewg CLI
2. Reduce workflow file complexity and duplication
3. Enable testing of project integration logic
4. Maintain consistency with `auto-tag` command pattern

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions Workflow                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ Checkout    │ -> │ Setup Deno  │ -> │ Run hewg    │     │
│  └─────────────┘    └─────────────┘    │ CLI command │     │
│                                         └──────┬──────┘     │
│                                                │             │
│                                         JSON output          │
│                                                │             │
│                                         ┌──────▼──────┐     │
│                                         │ Parse JSON  │     │
│                                         │ & Comment   │     │
│                                         └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Module Structure

```
src/
├── main.ts                      # CLI entry point (add new command registrations)
├── cli/
│   └── commands/
│       ├── mod.ts               # Export new commands
│       ├── link-issue.ts        # NEW: link-issue command
│       ├── pr-status.ts         # NEW: pr-status command
│       └── auto-tag.ts          # Existing (reference pattern)
├── lib/
│   └── github-project.ts        # NEW: GitHub Project GraphQL API utilities
└── types/
    └── project-config.ts        # Existing project config types
```

## Component Design

### 1. GitHub Project API Module (`src/lib/github-project.ts`)

Shared utilities for GitHub Project GraphQL operations.

```typescript
/**
 * GitHub Project API client for GraphQL operations.
 * Handles authentication via PROJECT_TOKEN environment variable.
 */
export interface GitHubProjectClient {
  getProject(url: string): Promise<Project>;
  addIssueToProject(projectId: string, issueNodeId: string): Promise<ProjectItem>;
  updateItemField(params: UpdateFieldParams): Promise<void>;
  getProjectItems(projectId: string): Promise<ProjectItem[]>;
}

export interface Project {
  id: string;
  title: string;
  fields: ProjectField[];
}

export interface ProjectField {
  id: string;
  name: string;
  type: 'SINGLE_SELECT' | 'ITERATION' | 'NUMBER' | 'DATE' | 'TEXT';
  options?: { id: string; name: string }[];
  iterations?: { id: string; title: string }[];
}

export interface ProjectItem {
  id: string;
  contentId: string;
  contentType: 'Issue' | 'PullRequest';
  issueNumber?: number;
}
```

### 2. Link-Issue Command (`src/cli/commands/link-issue.ts`)

#### Command Interface

```bash
hewg link-issue \
  --issue-number <number> \
  --repo <owner/repo> \
  --config <path> \
  [--json] \
  [--verbose]
```

#### Flags

| Flag | Short | Required | Default | Description |
|------|-------|----------|---------|-------------|
| `--issue-number` | `-i` | Yes | - | Issue number to add to project |
| `--repo` | `-r` | Yes | - | Repository in owner/repo format |
| `--config` | `-c` | No | `.github/project.toml` | Path to config file |
| `--json` | `-j` | No | false | Output result as JSON |
| `--verbose` | `-v` | No | false | Enable verbose logging |

#### JSON Output Schema

```typescript
interface LinkIssueResult {
  success: boolean;
  issueNumber: number;
  projectItemId?: string;
  projectTitle?: string;
  fieldsSet?: string[];
  error?: string;
  context?: {
    repo: string;
    configPath: string;
  };
}
```

#### Algorithm

1. Read and parse TOML config
2. Validate `project.url` exists
3. Get issue node ID via GitHub REST API
4. Get project ID and fields via GraphQL
5. Add issue to project (`addProjectV2ItemById`)
6. Set default field values from `[defaults]` section:
   - Status (single select)
   - Priority (single select)
   - Iteration (iteration field)
   - Size/Estimate (number fields)
   - Start date/Target date (date fields)
7. Return result JSON

### 3. PR-Status Command (`src/cli/commands/pr-status.ts`)

#### Command Interface

```bash
hewg pr-status \
  --pr-number <number> \
  --repo <owner/repo> \
  --branch <name> \
  [--body <text>] \
  [--draft] \
  --config <path> \
  [--json] \
  [--verbose]
```

#### Flags

| Flag | Short | Required | Default | Description |
|------|-------|----------|---------|-------------|
| `--pr-number` | `-p` | Yes | - | Pull request number |
| `--repo` | `-r` | Yes | - | Repository in owner/repo format |
| `--branch` | `-b` | Yes | - | Source branch name |
| `--body` | - | No | - | PR body text |
| `--draft` | `-d` | No | false | Whether PR is a draft |
| `--config` | `-c` | No | `.github/project.toml` | Path to config file |
| `--json` | `-j` | No | false | Output result as JSON |
| `--verbose` | `-v` | No | false | Enable verbose logging |

#### JSON Output Schema

```typescript
interface PrStatusResult {
  success: boolean;
  prNumber: number;
  processedIssues: number[];
  failedIssues: number[];
  skippedIssues: number[];
  newStatus: string;
  isDraft: boolean;
  skippedDraft: boolean;
  error?: string;
  context?: {
    repo: string;
    branch: string;
    configPath: string;
  };
}
```

#### Algorithm

1. Read and parse TOML config
2. Check if draft PR should be skipped (`pr.ignore_draft`)
3. Extract issue numbers:
   - From branch name using `pr.branch_pattern` regex
   - From body text using keywords (Closes/Fixes/Resolves #N)
4. For each unique issue number:
   - Get issue node ID
   - Check if issue is in project
   - If not, add to project
   - Update Status field to `pr.review_status` (default: "In Review")
5. Return aggregated result JSON

### 4. Issue Number Extraction

```typescript
/**
 * Extract issue numbers from branch name using configurable pattern.
 * Default pattern: ^[^/]+/[^/]+/(\d+)/.*$
 * Example: feature/alice/123/add-auth -> [123]
 */
export function extractFromBranch(branchName: string, pattern: string): number[];

/**
 * Extract issue numbers from PR body using GitHub keywords.
 * Keywords: close[sd], fix(e[sd])?, resolve[sd]
 * Example: "Fixes #123, Closes #456" -> [123, 456]
 */
export function extractFromBody(body: string): number[];
```

## Configuration

### project.toml Schema

```toml
[project]
url = "https://github.com/users/username/projects/1"

[defaults]
status = "Todo"
priority = "Medium"
# iteration = "Sprint 1"
# size = 3
# estimate = 5
# start_date = "2026-01-01"
# target_date = "2026-01-15"

[pr]
review_status = "In Review"
branch_pattern = "^[^/]+/[^/]+/(\\d+)/.*$"
ignore_draft = false
```

## Error Handling

### Error Types

| Error | Exit Code | Handling |
|-------|-----------|----------|
| Config file not found | 1 | Return error in JSON, workflow comments on issue |
| Invalid project URL | 1 | Return error in JSON |
| Issue not found | 1 | Return error in JSON |
| Project not found | 1 | Return error in JSON |
| API authentication failed | 1 | Return error in JSON |
| Field option not found | 0 | Log warning, continue with other fields |

### Error Output Format

```json
{
  "success": false,
  "error": "Project not found: https://github.com/...",
  "context": {
    "repo": "owner/repo",
    "configPath": ".github/project.toml"
  }
}
```

## Authentication

Environment variable: `PROJECT_TOKEN`

Required scopes:
- `project` - For GitHub Project access
- `repo` - For issue/PR access (usually included)

The CLI reads the token from environment variable and passes it to GraphQL requests via Authorization header.

## Workflow Integration

### issue-to-project.yml (After Refactoring)

```yaml
- name: Run link-issue command
  id: link-issue
  env:
    PROJECT_TOKEN: ${{ secrets.PROJECT_TOKEN }}
  run: |
    result=$(deno run --allow-read --allow-env --allow-net \
      src/main.ts link-issue \
      --issue-number "${{ github.event.issue.number }}" \
      --repo "${{ github.repository }}" \
      --config ".github/project.toml" \
      --json)
    echo "result=$result" >> $GITHUB_OUTPUT
```

### pr-status-update.yml (After Refactoring)

```yaml
- name: Run pr-status command
  id: pr-status
  env:
    PROJECT_TOKEN: ${{ secrets.PROJECT_TOKEN }}
  run: |
    result=$(deno run --allow-read --allow-env --allow-net \
      src/main.ts pr-status \
      --pr-number "${{ github.event.pull_request.number }}" \
      --repo "${{ github.repository }}" \
      --branch "${{ github.head_ref }}" \
      --body "${{ github.event.pull_request.body }}" \
      ${{ github.event.pull_request.draft && '--draft' || '' }} \
      --config ".github/project.toml" \
      --json)
    echo "result=$result" >> $GITHUB_OUTPUT
```

## Testing Strategy

### Unit Tests

1. **Issue extraction tests**
   - `extractFromBranch()` with various patterns
   - `extractFromBody()` with various keyword formats

2. **Config parsing tests**
   - Valid TOML parsing
   - Missing optional fields
   - Invalid project URL

3. **JSON output tests**
   - Success result format
   - Error result format

### Integration Tests (Manual)

1. Create test issue, verify it's added to project
2. Create PR with issue reference, verify status update
3. Test with draft PR and `ignore_draft` setting

## Security Considerations

1. **Token handling**: Never log or include token in error messages
2. **Input validation**: Validate issue/PR numbers are positive integers
3. **URL validation**: Validate project URL format before making requests
4. **Rate limiting**: Respect GitHub API rate limits (not implemented in MVP)

## Dependencies

- `@std/fmt/colors` - Terminal color output
- Deno built-in `fetch` - HTTP requests for GraphQL API

## Future Enhancements

1. Caching project field metadata
2. Batch processing for multiple issues
3. Dry-run mode for testing
4. Support for organization projects vs user projects detection
