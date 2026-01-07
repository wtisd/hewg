# Implementation Workflow: Refactor Workflow CLI Commands

**Issue**: #13
**Date**: 2026-01-07

## Phase Overview

| Phase | Description                      | Dependencies |
| ----- | -------------------------------- | ------------ |
| 1     | Create GitHub Project API module | None         |
| 2     | Implement link-issue command     | Phase 1      |
| 3     | Implement pr-status command      | Phase 1      |
| 4     | Update workflow files            | Phase 2, 3   |
| 5     | Testing and validation           | Phase 4      |

## Phase 1: GitHub Project API Module

### Tasks

- [ ] Create `src/lib/github-project.ts`
- [ ] Implement `parseProjectUrl()` function
- [ ] Implement `createGitHubProjectClient()` factory
- [ ] Implement GraphQL query functions:
  - [ ] `getProject()` - Get project ID and fields
  - [ ] `addIssueToProject()` - Add issue to project
  - [ ] `updateItemField()` - Update field value
  - [ ] `getProjectItems()` - List project items
- [ ] Implement `getIssueNodeId()` - Get issue node ID via REST API

### Files to Create/Modify

```
src/lib/github-project.ts  (NEW)
src/lib/mod.ts             (NEW - export module)
```

### Commit Message

```
✨ feat: add GitHub Project API module

- Add GraphQL client for GitHub Projects V2
- Implement project/field/item operations
- Support both user and organization projects
```

## Phase 2: Link-Issue Command

### Tasks

- [ ] Create `src/cli/commands/link-issue.ts`
- [ ] Define command flags and options
- [ ] Implement `linkIssueAction()`:
  - [ ] Read and validate config
  - [ ] Get project info via GraphQL
  - [ ] Add issue to project
  - [ ] Set default field values
  - [ ] Return JSON result
- [ ] Export from `src/cli/commands/mod.ts`
- [ ] Register in `src/main.ts`
- [ ] Add unit tests for issue extraction logic

### Files to Create/Modify

```
src/cli/commands/link-issue.ts  (NEW)
src/cli/commands/mod.ts         (MODIFY - add export)
src/main.ts                     (MODIFY - register command)
tests/link-issue_test.ts        (NEW)
```

### Commit Message

```
✨ feat: add link-issue command

- Add command to link issues to GitHub Projects
- Support default field values from config
- JSON output for workflow integration
```

## Phase 3: PR-Status Command

### Tasks

- [ ] Create `src/cli/commands/pr-status.ts`
- [ ] Define command flags and options
- [ ] Implement issue number extraction:
  - [ ] `extractFromBranch()` with configurable pattern
  - [ ] `extractFromBody()` for GitHub keywords
- [ ] Implement `prStatusAction()`:
  - [ ] Read and validate config
  - [ ] Check draft PR handling
  - [ ] Extract and deduplicate issue numbers
  - [ ] Process each issue (add to project, update status)
  - [ ] Return aggregated JSON result
- [ ] Export from `src/cli/commands/mod.ts`
- [ ] Register in `src/main.ts`
- [ ] Add unit tests for extraction logic

### Files to Create/Modify

```
src/cli/commands/pr-status.ts   (NEW)
src/cli/commands/mod.ts         (MODIFY - add export)
src/main.ts                     (MODIFY - register command)
tests/pr-status_test.ts         (NEW)
```

### Commit Message

```
✨ feat: add pr-status command

- Add command to update issue status on PR events
- Extract issue numbers from branch and body
- Support draft PR skipping
- JSON output for workflow integration
```

## Phase 4: Update Workflow Files

### Tasks

- [ ] Update `issue-to-project.yml`:
  - [ ] Remove inline JavaScript
  - [ ] Add Deno setup step
  - [ ] Call `hewg link-issue` command
  - [ ] Parse JSON and comment on issue
  - [ ] Handle errors with failure comment
- [ ] Update `pr-status-update.yml`:
  - [ ] Remove inline JavaScript
  - [ ] Add Deno setup step
  - [ ] Call `hewg pr-status` command
  - [ ] Parse JSON and comment on PR
  - [ ] Handle errors with failure comment
- [ ] Update template files in `src/templates/`

### Files to Modify

```
.github/workflows/issue-to-project.yml     (MODIFY)
.github/workflows/pr-status-update.yml     (MODIFY)
src/templates/issue-to-project.yml         (MODIFY)
src/templates/pr-status-update.yml         (MODIFY)
```

### Commit Messages

```
♻️ refactor: update issue-to-project workflow to use CLI

- Replace inline JavaScript with hewg link-issue command
- Simplify workflow structure
- Maintain same functionality and error handling

♻️ refactor: update pr-status-update workflow to use CLI

- Replace inline JavaScript with hewg pr-status command
- Simplify workflow structure
- Maintain same functionality and error handling
```

## Phase 5: Testing and Validation

### Tasks

- [ ] Run `deno fmt` and `deno lint`
- [ ] Run `deno check **/*.ts`
- [ ] Run full test suite with coverage
- [ ] Manual testing:
  - [ ] Test link-issue with mock data
  - [ ] Test pr-status with various branch patterns
  - [ ] Test error scenarios

### Commands

```bash
# Format and lint
deno fmt
deno lint

# Type check
deno check src/**/*.ts

# Run tests with coverage
deno test --allow-read --allow-env --coverage=coverage/

# Generate coverage report
deno coverage coverage/ --lcov > coverage/lcov.info
```

### Commit Message

```
✅ test: add tests for link-issue and pr-status commands

- Add unit tests for issue extraction
- Add config parsing tests
- Achieve coverage targets
```

## Rollback Plan

If issues are discovered after deployment:

1. **Workflow rollback**: Revert workflow files to previous inline JavaScript version
2. **CLI commands**: Can remain in codebase (unused by workflows)
3. **No data migration needed**: Commands operate on existing GitHub Project data

## Definition of Done

- [ ] All unit tests passing
- [ ] No lint errors
- [ ] No type errors
- [ ] Design document committed
- [ ] Workflow document committed
- [ ] All code reviewed and committed
- [ ] Workflow files updated and simplified
- [ ] JSON output matches expected schema
