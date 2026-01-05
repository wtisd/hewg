# Implementation Workflow: PR Status Update

**Issue**: #5 - Add GitHub Actions workflow to update Issue status to In Review on PR creation
**Date**: 2026-01-05
**Related Design**: [docs/design/issue-#5-pr-status-update.md](../design/issue-#5-pr-status-update.md)

## Overview

This document outlines the step-by-step implementation workflow for the PR Status Update feature.

## Phase Summary

| Phase | Description             | Tasks |
| ----- | ----------------------- | ----- |
| 1     | Template Creation       | 2     |
| 2     | Workflow Implementation | 4     |
| 3     | CLI Updates             | 2     |
| 4     | Testing & Documentation | 2     |

## Dependency Graph

```
Phase 1: Templates
├── [1.1] Update project.toml template (add [pr] section)
└── [1.2] Create pr-status-update.yml template

Phase 2: Workflow Implementation (depends on 1.1, 1.2)
├── [2.1] Implement Issue number extraction
├── [2.2] Implement Project item lookup
├── [2.3] Implement auto-add to Project
└── [2.4] Implement status update with error handling

Phase 3: CLI Updates (depends on 2.4)
├── [3.1] Update setup-actions command
└── [3.2] Update command documentation

Phase 4: Testing (depends on 3.2)
├── [4.1] Manual workflow test
└── [4.2] Update README
```

---

## Phase 1: Template Creation

### Task 1.1: Update project.toml Template

**File**: `src/templates/project.toml`

Add new `[pr]` section:

```toml
[pr]
# PR Status Update Configuration

# Status to set when PR is opened/reopened
# Must match an existing status option in your project
review_status = "In Review"

# Branch name pattern for Issue number extraction
# Default matches: label/author/{issue_number}/title
branch_pattern = "^[^/]+/[^/]+/(\\d+)/.*$"

# Whether to ignore Draft PRs (true = skip draft PRs)
ignore_draft = false
```

**Verification**:

```bash
deno fmt src/templates/project.toml
```

### Task 1.2: Create pr-status-update.yml Template

**File**: `src/templates/pr-status-update.yml`

Create workflow template with:

- Trigger on `pull_request: [opened, reopened]`
- TOML parser (reuse from issue-to-project.yml)
- Issue number extraction logic
- Project lookup and status update logic
- Error handling with PR comments

**Verification**:

```bash
# Validate YAML syntax
deno eval "import { parse } from 'jsr:@std/yaml'; console.log(parse(Deno.readTextFileSync('src/templates/pr-status-update.yml')))"
```

---

## Phase 2: Workflow Implementation

### Task 2.1: Implement Issue Number Extraction

**Location**: Within `pr-status-update.yml` script section

```javascript
// Extract from branch name
function extractFromBranch(branchName, pattern) {
  const regex = new RegExp(pattern);
  const match = branchName.match(regex);
  return match ? [parseInt(match[1], 10)] : [];
}

// Extract from PR body
function extractFromBody(body) {
  const regex = /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi;
  const issues = [];
  let match;
  while ((match = regex.exec(body)) !== null) {
    issues.push(parseInt(match[1], 10));
  }
  return issues;
}
```

### Task 2.2: Implement Project Item Lookup

**Location**: Within `pr-status-update.yml` script section

```javascript
// Find project item by Issue node ID
async function findProjectItem(projectId, issueNodeId) {
  const query = `
    query($projectId: ID!) {
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
  `;
  const result = await github.graphql(query, { projectId });
  const items = result.node?.items?.nodes || [];
  return items.find((item) => item.content?.id === issueNodeId);
}
```

### Task 2.3: Implement Auto-Add to Project

**Location**: Within `pr-status-update.yml` script section

Reuse `addProjectV2ItemById` mutation from issue-to-project.yml.

### Task 2.4: Implement Status Update with Error Handling

**Location**: Within `pr-status-update.yml` script section

- Update status field using `updateProjectV2ItemFieldValue`
- Handle errors gracefully
- Comment on PR with results

---

## Phase 3: CLI Updates

### Task 3.1: Update setup-actions Command

**File**: `src/cli/commands/setup-actions.ts`

Modify to also deploy `pr-status-update.yml`:

```typescript
// Add to template deployment
const templates = [
  { src: 'issue-to-project.yml', dest: '.github/workflows/issue-to-project.yml' },
  { src: 'pr-status-update.yml', dest: '.github/workflows/pr-status-update.yml' },
  { src: 'project.toml', dest: '.github/project.toml' },
];
```

### Task 3.2: Update Command Documentation

Update help text and console output to mention PR status update feature.

---

## Phase 4: Testing & Documentation

### Task 4.1: Manual Workflow Test

**Test Cases**:

1. **Branch name extraction**
   - Create PR with branch: `feature/user/123/test-feature`
   - Verify Issue #123 status changes to "In Review"

2. **Keyword extraction**
   - Create PR with body: `Fixes #456`
   - Verify Issue #456 status changes

3. **Multiple Issues**
   - Create PR with: `Closes #123, Fixes #456`
   - Verify both Issues are updated

4. **Issue not in Project**
   - Create PR for Issue not yet in Project
   - Verify Issue is auto-added and status set

5. **Draft PR handling**
   - Set `ignore_draft = true`
   - Create Draft PR
   - Verify no status change

6. **No Issue found**
   - Create PR with no Issue reference
   - Verify warning comment on PR

### Task 4.2: Update README

Add section documenting PR status update feature.

---

## Implementation Checklist

### Phase 1: Template Creation

- [ ] Update `src/templates/project.toml` with `[pr]` section
- [ ] Create `src/templates/pr-status-update.yml`

### Phase 2: Workflow Implementation

- [ ] Implement Issue number extraction (branch + keywords)
- [ ] Implement Project item lookup
- [ ] Implement auto-add to Project
- [ ] Implement status update with error handling

### Phase 3: CLI Updates

- [ ] Update `src/cli/commands/setup-actions.ts`
- [ ] Update command help/documentation

### Phase 4: Testing

- [ ] Manual end-to-end test
- [ ] Update README.md

---

## Commit Strategy

| Commit | Content                                              |
| ------ | ---------------------------------------------------- |
| 1      | `docs: add design and workflow for PR status update` |
| 2      | `feat: add pr-status-update.yml workflow template`   |
| 3      | `feat: update project.toml with [pr] section`        |
| 4      | `feat: update setup-actions to deploy PR workflow`   |
| 5      | `docs: update README with PR status update feature`  |

---

## Success Criteria

- [ ] PR creation triggers status update workflow
- [ ] Issue numbers extracted from branch name and PR body
- [ ] Issues not in Project are auto-added
- [ ] Status correctly updated to configured value
- [ ] Errors reported via PR comments
- [ ] CLI setup command deploys new workflow
- [ ] All tests pass
- [ ] Documentation complete
