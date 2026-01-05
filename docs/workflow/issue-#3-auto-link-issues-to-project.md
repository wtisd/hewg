# Implementation Workflow: Auto Link Issues to Project

**Issue**: #3 - Add GitHub Actions workflow to automatically link Issues to Project
**Date**: 2026-01-05
**Related Design**: [docs/design/issue-#3-auto-link-issues-to-project.md](../design/issue-#3-auto-link-issues-to-project.md)

## Overview

This document outlines the step-by-step implementation workflow for the Issue-to-Project auto-linking feature.

## Phase Summary

| Phase | Description                | Estimated Tasks |
| ----- | -------------------------- | --------------- |
| 1     | Foundation Setup           | 3 tasks         |
| 2     | Template Creation          | 2 tasks         |
| 3     | CLI Command Implementation | 3 tasks         |
| 4     | Integration & Testing      | 3 tasks         |
| 5     | Documentation              | 2 tasks         |

## Dependency Graph

```
Phase 1: Foundation
├── [1.1] Add @std/toml dependency
├── [1.2] Create type definitions
└── [1.3] Create templates directory

Phase 2: Templates (depends on 1.3)
├── [2.1] Create workflow template
└── [2.2] Create config template

Phase 3: CLI Command (depends on 1.2, 2.1, 2.2)
├── [3.1] Implement setup-actions command
├── [3.2] Register command in CLI
└── [3.3] Add deno task

Phase 4: Testing (depends on 3.3)
├── [4.1] Unit tests for config parsing
├── [4.2] Integration tests for CLI
└── [4.3] Manual workflow test

Phase 5: Documentation (parallel with Phase 4)
├── [5.1] Update README
└── [5.2] Add inline documentation
```

---

## Phase 1: Foundation Setup

### Task 1.1: Add @std/toml Dependency

**File**: `deno.json`

```json
{
  "imports": {
    "@std/toml": "jsr:@std/toml@^1.0.0"
  }
}
```

**Verification**:

```bash
deno check src/types/project-config.ts
```

### Task 1.2: Create Type Definitions

**File**: `src/types/project-config.ts`

Create TypeScript interfaces for:

- `ProjectConfig` - Main configuration interface
- `ProjectDefaults` - Default field values
- `StatusValue`, `PriorityValue` - Field value types

**Verification**:

```bash
deno check src/types/project-config.ts
```

### Task 1.3: Create Templates Directory

**Structure**:

```
src/
└── templates/
    ├── issue-to-project.yml    # Workflow template
    └── project.toml            # Config template
```

**Command**:

```bash
mkdir -p src/templates
```

---

## Phase 2: Template Creation

### Task 2.1: Create Workflow Template

**File**: `src/templates/issue-to-project.yml`

GitHub Actions workflow that:

1. Triggers on `issues: opened`
2. Checks out repository
3. Parses `.github/project.toml`
4. Adds Issue to Project via GraphQL
5. Sets field values
6. Comments on Issue if error occurs

**Key Implementation Points**:

- Use `actions/github-script@v7` for GraphQL
- Parse TOML using inline JavaScript
- Handle errors gracefully with Issue comments

### Task 2.2: Create Config Template

**File**: `src/templates/project.toml`

Default configuration template with:

- Placeholder project URL
- Common default values
- Commented examples for all fields

---

## Phase 3: CLI Command Implementation

### Task 3.1: Implement Setup-Actions Command

**File**: `src/cli/commands/setup-actions.ts`

```typescript
// Command structure
export const setupActionsCommand: Command = {
  name: 'setup-actions',
  description: 'Setup GitHub Actions for Issue-to-Project linking',
  aliases: ['setup'],
  flags: [
    { long: 'force', short: 'f', description: 'Overwrite existing files' },
    { long: 'project-url', short: 'p', takesValue: true, description: 'Project URL' },
  ],
  action: setupActionsAction,
};

// Implementation steps:
// 1. Check for existing files
// 2. Create .github/workflows directory
// 3. Copy workflow template
// 4. Create project.toml with user's URL if provided
// 5. Display success message and next steps
```

**Verification**:

```bash
deno check src/cli/commands/setup-actions.ts
```

### Task 3.2: Register Command in CLI

**File**: `src/cli/commands/mod.ts`

Add export for new command:

```typescript
export { setupActionsCommand } from './setup-actions.ts';
```

**File**: `src/main.ts` (or CLI initialization)

Register the command:

```typescript
cli.register(setupActionsCommand);
```

### Task 3.3: Add Deno Task

**File**: `deno.json`

```json
{
  "tasks": {
    "setup:actions": "deno run --allow-read --allow-write src/cli/commands/setup-actions.ts"
  }
}
```

**Verification**:

```bash
deno task setup:actions --help
```

---

## Phase 4: Integration & Testing

### Task 4.1: Unit Tests for Config Parsing

**File**: `tests/project-config.test.ts`

Test cases:

- Valid TOML parsing
- Missing required fields
- Invalid field values
- Default value handling

```typescript
Deno.test('parseProjectConfig - valid config', () => {
  // Test implementation
});

Deno.test('parseProjectConfig - missing url', () => {
  // Should throw error
});
```

### Task 4.2: Integration Tests for CLI

**File**: `tests/setup-actions.test.ts`

Test cases:

- Files created in correct locations
- Existing files not overwritten (without --force)
- --force flag behavior
- --project-url flag populates config

### Task 4.3: Manual Workflow Test

**Steps**:

1. Run `deno task setup:actions`
2. Configure `PROJECT_TOKEN` secret in repository
3. Update `.github/project.toml` with actual project URL
4. Create a test Issue
5. Verify Issue appears in Project
6. Test error scenarios (invalid token, wrong URL)

---

## Phase 5: Documentation

### Task 5.1: Update README

**File**: `README.md`

Add section:

```markdown
## GitHub Actions Setup

Automatically link new Issues to your GitHub Project:

\`\`\`bash
deno task setup:actions
\`\`\`

### Configuration

1. Create a Personal Access Token with `project` scope
2. Add it as repository secret: `PROJECT_TOKEN`
3. Edit `.github/project.toml` with your project URL
```

### Task 5.2: Add Inline Documentation

Ensure all exported functions have JSDoc comments:

- `setupActionsCommand` - Command definition
- `setupActionsAction` - Main action handler
- `parseProjectConfig` - Config parsing utility

---

## Implementation Checklist

### Phase 1: Foundation Setup

- [ ] Add `@std/toml` to deno.json imports
- [ ] Create `src/types/project-config.ts`
- [ ] Create `src/templates/` directory

### Phase 2: Template Creation

- [ ] Create `src/templates/issue-to-project.yml`
- [ ] Create `src/templates/project.toml`

### Phase 3: CLI Command

- [ ] Implement `src/cli/commands/setup-actions.ts`
- [ ] Update `src/cli/commands/mod.ts`
- [ ] Add `setup:actions` task to deno.json

### Phase 4: Testing

- [ ] Write unit tests for config parsing
- [ ] Write integration tests for CLI
- [ ] Manual end-to-end test

### Phase 5: Documentation

- [ ] Update README.md
- [ ] Add JSDoc comments

---

## Commit Strategy

| Commit | Content                                                   |
| ------ | --------------------------------------------------------- |
| 1      | `feat: add project config types and @std/toml dependency` |
| 2      | `feat: add GitHub Actions workflow template`              |
| 3      | `feat: implement setup-actions CLI command`               |
| 4      | `test: add tests for project config and setup command`    |
| 5      | `docs: add setup instructions to README`                  |

---

## Rollback Procedure

If issues are discovered after deployment:

1. **Immediate**: Delete `.github/workflows/issue-to-project.yml` to stop triggers
2. **Investigation**: Check workflow run logs for errors
3. **Fix**: Update templates and regenerate files
4. **Re-deploy**: Run `deno task setup:actions --force`

---

## Success Criteria

- [ ] `deno task setup:actions` creates all required files
- [ ] New Issues automatically appear in configured Project
- [ ] Field defaults are correctly applied
- [ ] Errors are reported via Issue comments
- [ ] All tests pass
- [ ] Documentation is complete
