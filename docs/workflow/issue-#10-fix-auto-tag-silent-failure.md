# Implementation Workflow: Fix Auto Tag Silent Failure

**Issue**: #10
**Branch**: `bugfix/wtisd/#10/fix-auto-tag-silent-failure`
**Created**: 2026-01-07

## Phase 1: CLI Improvements

### Step 1.1: Add --verbose Flag

**File**: `src/cli/commands/auto-tag.ts`

1. Add verbose flag to command definition
2. Create logging helper function
3. Add verbose logging throughout the command

**Acceptance Criteria**:
- [ ] `--verbose` or `-V` flag is available
- [ ] Verbose output goes to stderr (not stdout)
- [ ] Does not interfere with JSON output

### Step 1.2: Improve Error Handling

**File**: `src/cli/commands/auto-tag.ts`

1. Wrap entire autoTagAction in try-catch
2. Ensure JSON output is always produced when `--json` is set
3. Add context information to error output

**Acceptance Criteria**:
- [ ] Any error produces valid JSON when `--json` is set
- [ ] Error messages include context (branch name, config path)
- [ ] No silent failures

### Step 1.3: Edge Case Handling

**File**: `src/cli/commands/auto-tag.ts`

1. Improve error messages for "tag exists" case
2. Improve error messages for network failures
3. Add validation for branch names

**Acceptance Criteria**:
- [ ] Clear error message when tag already exists
- [ ] Clear error message on network failure
- [ ] Special characters in branch names handled correctly

## Phase 2: Workflow Improvements

### Step 2.1: Add Robust Error Handling

**File**: `.github/workflows/auto-tag.yml`

1. Capture stderr alongside stdout
2. Handle jq parse failures gracefully
3. Display actual error output on failure

**Changes**:
```yaml
run: |
  set +e
  output=$(deno run ... 2>&1)
  exit_code=$?
  set -e

  if [ $exit_code -ne 0 ]; then
    echo "::error::Command failed"
    echo "$output"
    exit 1
  fi

  # Validate JSON
  if ! echo "$output" | jq -e . > /dev/null 2>&1; then
    echo "::error::Invalid JSON"
    echo "$output"
    exit 1
  fi
  ...
```

**Acceptance Criteria**:
- [ ] Error output is visible in workflow logs
- [ ] jq failures are handled gracefully
- [ ] Actual error message is displayed

### Step 2.2: Update Template

**File**: `src/templates/auto-tag.yml`

Apply same changes as workflow file.

## Phase 3: Testing

### Step 3.1: Add Unit Tests

**File**: `tests/cli/commands/auto-tag.test.ts`

Test functions:
- `parseVersion()` - various version formats
- `extractLabel()` - branch name parsing
- `getIncrementType()` - label to increment mapping
- `calculateNewVersion()` - version calculation

### Step 3.2: Manual Testing

1. Run CLI with `--verbose` flag
2. Test with branch name containing `#`
3. Test error cases (no config file, invalid config)

## Phase 4: Quality Checks

### Step 4.1: Run Lint and Format

```bash
deno fmt
deno lint
```

### Step 4.2: Run Type Check

```bash
deno check src/**/*.ts
```

### Step 4.3: Run Tests

```bash
deno test --allow-read --allow-env
```

## Commit Strategy

| Commit | Description |
|--------|-------------|
| 1 | Add --verbose flag to auto-tag command |
| 2 | Improve error handling in auto-tag command |
| 3 | Fix workflow error handling and add stderr capture |
| 4 | Add unit tests for auto-tag functions |
| 5 | Add design and workflow documentation |

## Verification Checklist

Before creating PR:

- [ ] All tests pass
- [ ] `deno fmt --check` passes
- [ ] `deno lint` passes
- [ ] `deno check` passes
- [ ] Manual test with verbose flag works
- [ ] Documentation is complete
