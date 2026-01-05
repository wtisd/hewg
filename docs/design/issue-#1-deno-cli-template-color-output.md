# Design Document: Deno CLI Tool Template with Color Output

**Issue**: #1
**Title**: Add Deno CLI tool template with color output support
**Author**: wtisd
**Date**: 2026-01-05
**Status**: Draft

---

## 1. Overview

### 1.1 Purpose

This document describes the design for a Deno CLI tool template (`@erdtree/hewg`) that provides:

- A flexible CLI framework with subcommands, flags, and arguments
- Color output support using `@std/fmt/colors`
- Complete development environment (DevContainer, Docker, CI/CD)
- Production-ready test suite

### 1.2 Scope

| In Scope | Out of Scope |
|----------|--------------|
| CLI framework core | Plugin/extension system |
| Color output utilities | Interactive prompts |
| Sample commands | Configuration file parsing |
| Test infrastructure | Network operations |
| CI/CD workflows | Database integration |

---

## 2. Architecture

### 2.1 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Entry Point                              │
│                        (main.ts)                                │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        CLI Framework                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      Cli Class                            │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                │  │
│  │  │ commands: Map   │  │ aliases: Map    │                │  │
│  │  └─────────────────┘  └─────────────────┘                │  │
│  │                                                           │  │
│  │  Methods:                                                 │  │
│  │  - register(command)  - parse(args)                       │  │
│  │  - run(args)          - showHelp()                        │  │
│  │  - getCommand(name)   - showCommandHelp(cmd)              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Color Utilities                         │  │
│  │  - success(text)   - error(text)   - warn(text)          │  │
│  │  - info(text)      - highlight(text)                      │  │
│  │  - dim(text)       - bold(text)                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Commands                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │    hello     │  │   version    │  │   (user-defined)     │  │
│  │  - name arg  │  │  - json flag │  │                      │  │
│  │  - loud flag │  │              │  │                      │  │
│  │  - count flag│  │              │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Module Structure

```
src/
├── mod.ts                 # Public API exports
├── main.ts                # CLI entry point
├── version.ts             # Version constant
└── cli/
    ├── mod.ts             # CLI module exports
    ├── cli.ts             # Core Cli class
    ├── types.ts           # Type definitions
    ├── colors.ts          # Color utilities (NEW)
    └── commands/
        ├── mod.ts         # Command exports
        ├── hello.ts       # Hello command
        └── version.ts     # Version command
```

---

## 3. Component Design

### 3.1 Color Utilities (`src/cli/colors.ts`)

#### 3.1.1 Purpose

Provide semantic color functions for consistent CLI output styling.

#### 3.1.2 Interface Design

```typescript
/**
 * Color utility functions for CLI output
 * @module
 */

import { bold, cyan, dim, green, red, yellow } from '@std/fmt/colors';

/** Format success messages (green) */
export function success(text: string): string;

/** Format error messages (red + bold) */
export function error(text: string): string;

/** Format warning messages (yellow) */
export function warn(text: string): string;

/** Format informational text (cyan) */
export function info(text: string): string;

/** Format highlighted text (cyan + bold) */
export function highlight(text: string): string;

/** Format de-emphasized text (dim) */
export function muted(text: string): string;

/** Format command/option names (cyan) */
export function command(text: string): string;

/** Format flag names (yellow) */
export function flag(text: string): string;

/** Format argument placeholders (dim) */
export function argument(text: string): string;
```

#### 3.1.3 Color Scheme

| Semantic Function | Color Combination | Use Case |
|-------------------|-------------------|----------|
| `success` | green | Success messages, confirmations |
| `error` | red + bold | Error messages, failures |
| `warn` | yellow | Warnings, cautions |
| `info` | cyan | Informational messages |
| `highlight` | cyan + bold | Emphasized text |
| `muted` | dim | Secondary information |
| `command` | cyan | Command names in help |
| `flag` | yellow | Flag names (--flag) |
| `argument` | dim | Argument placeholders (<arg>) |

### 3.2 CLI Class Modifications

#### 3.2.1 Help Output Enhancement

**Before:**
```
hewg 0.1.0

A versatile CLI framework for Deno

USAGE:
  hewg <command> [options]

COMMANDS:
  hello    Say hello to someone
  version  Show version information
```

**After (with colors):**
```
hewg 0.1.0

A versatile CLI framework for Deno

USAGE:
  hewg <command> [options]      ← command in cyan, <command> dimmed

COMMANDS:
  hello    Say hello to someone   ← "hello" in cyan
  version  Show version information

OPTIONS:
  -h, --help      Show help       ← flags in yellow
  -v, --version   Show version
```

#### 3.2.2 Error Output Enhancement

```typescript
// Before
console.error(`Error: ${error}`);

// After
console.error(colors.error(`Error: ${error}`));
```

### 3.3 Type Definitions

No changes required to existing types. Color utilities are additive.

---

## 4. API Design

### 4.1 Public Exports (`src/mod.ts`)

```typescript
// Existing exports (unchanged)
export { Cli, createCli } from './cli/mod.ts';
export type { CliConfig, Command, CommandContext, CommandOptions } from './cli/types.ts';
export { VERSION } from './version.ts';

// New exports
export * as colors from './cli/colors.ts';
```

### 4.2 CLI Module Exports (`src/cli/mod.ts`)

```typescript
// Existing exports
export { Cli, createCli } from './cli.ts';
export type { /* ... */ } from './types.ts';

// New export
export * as colors from './colors.ts';
```

---

## 5. Configuration Changes

### 5.1 Package Name Update (`deno.json`)

```json
{
  "name": "@erdtree/hewg",
  "version": "0.1.0",
  // ... rest unchanged
}
```

### 5.2 No Additional Dependencies

Using only `@std/fmt/colors` which is already available via `@std/fmt`.

---

## 6. Error Handling Strategy

### 6.1 Color-Enhanced Error Messages

| Error Type | Format | Example |
|------------|--------|---------|
| Unknown command | `error()` | `Error: Unknown command: foo` |
| Missing argument | `error()` | `Error: Missing required argument: name` |
| Missing flag | `error()` | `Error: Missing required flag: --output` |
| Execution error | `error()` | `Error executing command: ...` |

### 6.2 Help Suggestions

```typescript
console.error(colors.muted(`Run '${colors.command('hewg --help')}' for usage.`));
```

---

## 7. Testing Strategy

### 7.1 Color Utility Tests

```typescript
Deno.test('colors.success formats green text', () => {
  const result = colors.success('OK');
  assertStringIncludes(result, '\x1b[32m'); // ANSI green
});
```

### 7.2 Integration Tests

Test help output contains expected color codes (or test in no-color mode).

---

## 8. Backward Compatibility

### 8.1 Breaking Changes

| Change | Impact | Migration |
|--------|--------|-----------|
| Package name | Import paths | Update `@anthropic/hewg` → `@erdtree/hewg` |

### 8.2 Non-Breaking Additions

- Color utilities are additive
- Help output changes are visual only
- No API changes to Cli class public interface

---

## 9. Future Considerations

### 9.1 NO_COLOR Support

Respect the `NO_COLOR` environment variable:

```typescript
const useColors = !Deno.env.get('NO_COLOR');
```

### 9.2 Custom Color Themes

Future versions could support:

```typescript
const cli = createCli({
  name: 'my-tool',
  colors: {
    error: 'magenta',
    success: 'blue',
  },
});
```

---

## 10. Implementation Checklist

- [ ] Create `src/cli/colors.ts` with semantic color functions
- [ ] Update `deno.json` with new package name
- [ ] Modify `Cli.showHelp()` to use colors
- [ ] Modify `Cli.showCommandHelp()` to use colors
- [ ] Update error message formatting in `Cli.run()`
- [ ] Export colors from `src/cli/mod.ts`
- [ ] Export colors from `src/mod.ts`
- [ ] Update README with new package name
- [ ] Add tests for color utilities
- [ ] Verify existing tests pass

---

## Appendix A: Color ANSI Codes Reference

| Color | ANSI Code | Function |
|-------|-----------|----------|
| Red | `\x1b[31m` | `red()` |
| Green | `\x1b[32m` | `green()` |
| Yellow | `\x1b[33m` | `yellow()` |
| Cyan | `\x1b[36m` | `cyan()` |
| Bold | `\x1b[1m` | `bold()` |
| Dim | `\x1b[2m` | `dim()` |
| Reset | `\x1b[0m` | (auto) |
