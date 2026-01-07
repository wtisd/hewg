# Design Document: Fix Auto Tag Silent Failure

**Issue**: #10
**Type**: Bugfix
**Author**: Claude Code
**Created**: 2026-01-07

## Overview

This document describes the design for fixing the silent failure in the Auto Tag workflow and improving its robustness.

## Problem Analysis

### Symptoms

- Auto Tag workflow fails with exit code 1
- No output from CLI (neither success JSON nor error JSON)
- Failure occurs ~125ms after Deno finishes downloading dependencies

### Root Cause Analysis

The failure occurs due to a combination of factors:

1. **Workflow Script Issue**: The bash script uses `set -e` (exit on error)
2. **jq Parse Failure**: When CLI output is empty or invalid JSON, `jq` fails
3. **Silent Exit**: With `set -e`, bash exits immediately on jq failure without custom error message

### Code Flow Analysis

```
Workflow starts
    ↓
deno run auto-tag ... (captured in $result)
    ↓
If CLI fails → $result is empty or contains error
    ↓
jq -r '.success' on empty $result → jq fails with exit code 5
    ↓
bash exits immediately due to set -e
    ↓
No custom error message displayed
```

## Solution Design

### 1. Workflow Improvements (`.github/workflows/auto-tag.yml`)

#### 1.1 Robust Error Handling

```yaml
- name: Run auto-tag command
  id: auto-tag
  run: |
    # Capture both stdout and stderr
    set +e  # Temporarily disable exit on error
    result=$(deno run ... 2>&1)
    exit_code=$?
    set -e

    # Check if command succeeded
    if [ $exit_code -ne 0 ]; then
      echo "::error::CLI failed with exit code $exit_code"
      echo "Output: $result"
      exit 1
    fi

    # Validate JSON before parsing
    if ! echo "$result" | jq -e . > /dev/null 2>&1; then
      echo "::error::Invalid JSON output from CLI"
      echo "Output: $result"
      exit 1
    fi

    # Parse JSON safely
    success=$(echo "$result" | jq -r '.success // "false"')
    ...
```

#### 1.2 Deno Dependency Caching (Optional)

Add caching to avoid fresh downloads on each run:

```yaml
- name: Cache Deno dependencies
  uses: actions/cache@v4
  with:
    path: ~/.cache/deno
    key: deno-${{ hashFiles('deno.lock') }}
```

### 2. CLI Improvements (`src/cli/commands/auto-tag.ts`)

#### 2.1 Add `--verbose` Flag

```typescript
interface FlagDefinition {
  short: 'V';
  long: 'verbose';
  description: 'Enable verbose output for debugging';
}
```

#### 2.2 Verbose Logging Helper

```typescript
function log(message: string, verbose: boolean, jsonOutput: boolean): void {
  if (verbose && !jsonOutput) {
    console.error(`[DEBUG] ${message}`);
  }
}
```

Note: Verbose output goes to stderr to not interfere with JSON output on stdout.

#### 2.3 Enhanced Error Context

```typescript
interface AutoTagResult {
  success: boolean;
  currentTag: string | null;
  newTag: string | null;
  label: string;
  incrementType: 'MAJOR' | 'MINOR' | 'PATCH' | 'RC_ONLY';
  targetBranch: string;
  isDevelopToMain: boolean;
  error?: string;
  context?: {
    sourceBranch: string;
    configPath: string;
    gitDescribeOutput?: string;
  };
}
```

#### 2.4 Wrap Entire Function in Try-Catch

Move try-catch to encompass the entire function including flag extraction:

```typescript
async function autoTagAction(ctx: CommandContext): Promise<void> {
  let jsonOutput = false;
  let verbose = false;

  try {
    // Extract flags first
    jsonOutput = ctx.flags['json'] as boolean ?? false;
    verbose = ctx.flags['verbose'] as boolean ?? false;

    log('Starting auto-tag command', verbose, jsonOutput);
    log(`Flags: ${JSON.stringify(ctx.flags)}`, verbose, jsonOutput);

    // ... rest of implementation
  } catch (error) {
    // Always output JSON if possible, fallback to stderr
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (jsonOutput) {
      console.log(JSON.stringify({ success: false, error: errorMessage }));
    } else {
      console.error(`Error: ${errorMessage}`);
    }
    Deno.exit(1);
  }
}
```

### 3. Edge Case Handling

#### 3.1 No Tags Exist (First Run)

Current behavior is correct - `getLatestTag()` returns null, `parseVersion(null)` returns `{0,0,0,null}`.

Add verbose logging:

```typescript
const latestTag = await getLatestTag();
log(`Latest tag: ${latestTag ?? '(none)'}`, verbose, jsonOutput);
```

#### 3.2 Special Characters in Branch Name

Branch names with `#`, spaces, etc. should work because:

- GitHub Actions properly quotes the value
- Deno's argument parsing handles quoted strings correctly

Add validation and logging:

```typescript
log(`Source branch: "${sourceBranch}"`, verbose, jsonOutput);
if (sourceBranch.includes('#')) {
  log('Branch name contains # character (handled correctly)', verbose, jsonOutput);
}
```

#### 3.3 Tag Already Exists

Current behavior throws an error. Improve the error message:

```typescript
if (createCode !== 0) {
  const errorMsg = new TextDecoder().decode(createStderr).trim();
  if (errorMsg.includes('already exists')) {
    throw new Error(`Tag ${newTag} already exists. Delete it first or use a different version.`);
  }
  throw new Error(`Failed to create tag: ${errorMsg}`);
}
```

#### 3.4 Network Error on Push

Current behavior throws an error. Improve the error message:

```typescript
if (pushCode !== 0) {
  const errorMsg = new TextDecoder().decode(pushStderr).trim();
  if (errorMsg.includes('Could not resolve host') || errorMsg.includes('Connection refused')) {
    throw new Error(`Network error while pushing tag. Check your internet connection: ${errorMsg}`);
  }
  throw new Error(`Failed to push tag: ${errorMsg}`);
}
```

## File Changes Summary

| File                             | Changes                                                 |
| -------------------------------- | ------------------------------------------------------- |
| `src/cli/commands/auto-tag.ts`   | Add --verbose flag, improve error handling, add context |
| `.github/workflows/auto-tag.yml` | Add robust error handling, optional caching             |
| `src/templates/auto-tag.yml`     | Same changes as workflow (template for setup command)   |

## Testing Strategy

1. **Unit Tests**: Test individual functions (parseVersion, extractLabel, etc.)
2. **Integration Tests**: Test CLI with various inputs including edge cases
3. **Manual Tests**: Create PR with `#` in branch name and verify workflow

## Compatibility

- JSON output format remains backward compatible
- New `--verbose` flag is optional
- Existing workflows continue to work

## Rollback Plan

If issues arise:

1. Revert the commit
2. Original behavior is restored
3. No data loss possible (tags are independent)
