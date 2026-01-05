# Implementation Workflow: Deno CLI Tool Template with Color Output

**Issue**: #1
**Design Document**: [docs/design/issue-#1-deno-cli-template-color-output.md](../design/issue-#1-deno-cli-template-color-output.md)
**Date**: 2026-01-05
**Status**: In Progress

---

## Workflow Overview

```
Phase 1          Phase 2              Phase 3           Phase 4
┌─────────┐      ┌──────────────┐     ┌─────────┐      ┌──────────┐
│ Config  │ ──▶  │ Color Utils  │ ──▶ │  Tests  │ ──▶  │  Docs    │
│ Update  │      │ + CLI Update │     │         │      │  Update  │
└─────────┘      └──────────────┘     └─────────┘      └──────────┘
    │                   │                  │                │
    ▼                   ▼                  ▼                ▼
 Commit 1           Commit 2           Commit 3         Commit 4
```

---

## Phase 1: Configuration Update

### Tasks

| #   | Task                                   | File         | Status |
| --- | -------------------------------------- | ------------ | ------ |
| 1.1 | Update package name to `@erdtree/hewg` | `deno.json`  | ⬜     |
| 1.2 | Update README import examples          | `README.md`  | ⬜     |
| 1.3 | Update module docstring                | `src/mod.ts` | ⬜     |

### Details

#### 1.1 Update Package Name

**File**: `deno.json`

```diff
{
- "name": "@anthropic/hewg",
+ "name": "@erdtree/hewg",
  "version": "0.1.0",
```

#### 1.2 Update README Import Examples

**File**: `README.md`

Update all occurrences of:

- `jsr:@anthropic/hewg` → `jsr:@erdtree/hewg`
- `@anthropic/hewg` → `@erdtree/hewg`

#### 1.3 Update Module Docstring

**File**: `src/mod.ts`

```diff
- * import { createCli, Command } from "@anthropic/hewg";
+ * import { createCli, Command } from "@erdtree/hewg";
```

### Commit

```bash
git add deno.json README.md src/mod.ts
git commit -m "🔧 chore: rename package to @erdtree/hewg"
```

---

## Phase 2: Color Utilities Implementation

### Dependencies

- Phase 1 must be completed

### Tasks

| #   | Task                                | File                | Status |
| --- | ----------------------------------- | ------------------- | ------ |
| 2.1 | Create color utilities module       | `src/cli/colors.ts` | ⬜     |
| 2.2 | Export colors from CLI module       | `src/cli/mod.ts`    | ⬜     |
| 2.3 | Export colors from main module      | `src/mod.ts`        | ⬜     |
| 2.4 | Update CLI help output with colors  | `src/cli/cli.ts`    | ⬜     |
| 2.5 | Update CLI error output with colors | `src/cli/cli.ts`    | ⬜     |

### Details

#### 2.1 Create Color Utilities Module

**File**: `src/cli/colors.ts`

```typescript
/**
 * Color utilities for CLI output
 *
 * Provides semantic color functions for consistent terminal styling.
 *
 * @module
 */

import { bold, cyan, dim, green, red, yellow } from '@std/fmt/colors';

/** Format success messages (green) */
export function success(text: string): string {
  return green(text);
}

/** Format error messages (red + bold) */
export function error(text: string): string {
  return bold(red(text));
}

/** Format warning messages (yellow) */
export function warn(text: string): string {
  return yellow(text);
}

/** Format informational text (cyan) */
export function info(text: string): string {
  return cyan(text);
}

/** Format highlighted text (cyan + bold) */
export function highlight(text: string): string {
  return bold(cyan(text));
}

/** Format de-emphasized text (dim) */
export function muted(text: string): string {
  return dim(text);
}

/** Format command names (cyan) */
export function command(text: string): string {
  return cyan(text);
}

/** Format flag names (yellow) */
export function flag(text: string): string {
  return yellow(text);
}

/** Format argument placeholders (dim + italic style) */
export function argument(text: string): string {
  return dim(text);
}

/** Format section headers (bold) */
export function header(text: string): string {
  return bold(text);
}
```

#### 2.2 Export from CLI Module

**File**: `src/cli/mod.ts`

```diff
  export { Cli, createCli } from './cli.ts';
  export type { /* ... */ } from './types.ts';
+ export * as colors from './colors.ts';
```

#### 2.3 Export from Main Module

**File**: `src/mod.ts`

```diff
  export { Cli, createCli } from './cli/mod.ts';
  export type { /* ... */ } from './cli/types.ts';
  export { VERSION } from './version.ts';
+ export * as colors from './cli/colors.ts';
```

#### 2.4 Update CLI Help Output

**File**: `src/cli/cli.ts`

Areas to modify:

1. `showHelp()` method - Global help
2. `showCommandHelp()` method - Command-specific help

Example changes in `showHelp()`:

```typescript
import * as colors from './colors.ts';

private showHelp(): void {
  console.log(colors.highlight(`${this.config.name} ${this.config.version}`));
  // ...
  console.log(colors.header('USAGE:'));
  console.log(`  ${colors.command(this.config.name)} ${colors.argument('<command>')} [options]`);
  // ...
  console.log(colors.header('COMMANDS:'));
  for (const cmd of visibleCommands) {
    console.log(`  ${colors.command(cmd.name)}${padding}${cmd.description ?? ''}`);
  }
  // ...
  console.log(colors.header('OPTIONS:'));
  console.log(`  ${colors.flag('-h, --help')}      Show this help message`);
  console.log(`  ${colors.flag('-v, --version')}   Show version information`);
}
```

#### 2.5 Update CLI Error Output

**File**: `src/cli/cli.ts`

```typescript
// In run() method
console.error(colors.error(`Unknown command: ${args[0]}`));
console.error(colors.muted(`Run '${this.config.name} --help' for usage.`));
```

### Commit

```bash
git add src/cli/colors.ts src/cli/mod.ts src/mod.ts src/cli/cli.ts
git commit -m "✨ feat: add color output support to CLI"
```

---

## Phase 3: Testing

### Dependencies

- Phase 2 must be completed

### Tasks

| #   | Task                      | File                   | Status |
| --- | ------------------------- | ---------------------- | ------ |
| 3.1 | Add color utilities tests | `tests/colors_test.ts` | ⬜     |
| 3.2 | Run existing tests        | -                      | ⬜     |
| 3.3 | Run coverage analysis     | -                      | ⬜     |

### Details

#### 3.1 Color Utilities Tests

**File**: `tests/colors_test.ts`

```typescript
import { assertEquals, assertStringIncludes } from '@std/assert';
import * as colors from '../src/cli/colors.ts';

Deno.test('colors.success returns green text', () => {
  const result = colors.success('OK');
  assertStringIncludes(result, 'OK');
  // Contains ANSI green code
  assertStringIncludes(result, '\x1b[32m');
});

Deno.test('colors.error returns bold red text', () => {
  const result = colors.error('Error');
  assertStringIncludes(result, 'Error');
  assertStringIncludes(result, '\x1b[31m'); // red
  assertStringIncludes(result, '\x1b[1m'); // bold
});

// ... additional tests for each function
```

#### 3.2 Run Tests

```bash
deno task test
```

#### 3.3 Coverage Analysis

```bash
deno task test:coverage
deno task coverage
```

### Commit

```bash
git add tests/colors_test.ts
git commit -m "✅ test: add color utilities tests"
```

---

## Phase 4: Documentation & Finalization

### Dependencies

- Phase 3 must be completed

### Tasks

| #   | Task                              | File        | Status |
| --- | --------------------------------- | ----------- | ------ |
| 4.1 | Update README with color examples | `README.md` | ⬜     |
| 4.2 | Run full CI checks                | -           | ⬜     |
| 4.3 | Final review                      | -           | ⬜     |

### Details

#### 4.1 Update README

Add a section about color output:

```markdown
## Color Output

hewg includes built-in color utilities for terminal output:

\`\`\`ts
import { colors } from '@erdtree/hewg';

console.log(colors.success('Operation completed!'));
console.log(colors.error('Something went wrong'));
console.log(colors.warn('Warning: deprecated feature'));
console.log(colors.info('Information message'));
\`\`\`
```

#### 4.2 Run Full CI Checks

```bash
deno task ci
```

This runs:

- `deno fmt --check`
- `deno lint`
- `deno check`
- `deno test`

### Commit

```bash
git add README.md
git commit -m "📝 docs: update README with color output examples"
```

---

## Quality Gates

### Pre-Commit Checklist

For each commit:

- [ ] `deno fmt` - Code is formatted
- [ ] `deno lint` - No linting errors
- [ ] `deno check src/**/*.ts tests/**/*.ts` - No type errors
- [ ] `deno task test` - All tests pass

### Final Verification

Before marking complete:

- [ ] All phases completed
- [ ] Full CI passes (`deno task ci`)
- [ ] Coverage meets target (>80%)
- [ ] No regressions in existing tests
- [ ] README accurately reflects changes

---

## Rollback Plan

If issues are discovered:

### Phase-Specific Rollback

```bash
# Rollback to before Phase N
git reset --hard HEAD~N
```

### Complete Rollback

```bash
# Return to develop branch
git checkout develop
git branch -D feature/wtisd/#1/deno-cli-template-color-output
```

---

## Progress Tracking

| Phase                  | Status         | Commits |
| ---------------------- | -------------- | ------- |
| Phase 1: Configuration | ⬜ Not Started | 0/1     |
| Phase 2: Color Utils   | ⬜ Not Started | 0/1     |
| Phase 3: Testing       | ⬜ Not Started | 0/1     |
| Phase 4: Documentation | ⬜ Not Started | 0/1     |

**Legend**: ⬜ Not Started | 🔄 In Progress | ✅ Completed

---

## Estimated Effort

| Phase     | Estimated Time  |
| --------- | --------------- |
| Phase 1   | 10 minutes      |
| Phase 2   | 30 minutes      |
| Phase 3   | 20 minutes      |
| Phase 4   | 15 minutes      |
| **Total** | **~75 minutes** |

---

## Notes

- Color output uses Deno's `@std/fmt/colors` for consistency
- No external dependencies added
- Backward compatible - no breaking changes to public API
- Colors respect terminal capabilities automatically
