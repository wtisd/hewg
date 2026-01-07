# Workflow: Fix Special Character Escaping in pr-status-update Workflow

## Issue

- **Issue**: #18
- **Type**: Bug Fix
- **Branch**: `bugfix/wtisd/#18/fix-special-character-escaping`

## Implementation Steps

### Phase 1: Fix Shell Script (Line 53)

1. Add `PR_BODY` environment variable to the step
2. Use environment variable reference instead of inline substitution
3. Ensure proper quoting with double quotes

### Phase 2: Fix JavaScript (Line 133)

1. Replace template literal with `toJSON()` output
2. `toJSON()` already produces valid JSON string, no `JSON.parse()` needed
3. Test with various special characters

### Phase 3: Verification

1. Run `deno fmt` to check formatting
2. Run `deno lint` to check for issues
3. Manual verification with test PR

## Task Breakdown

- [ ] Modify Line 53: Use environment variable for PR body
- [ ] Modify Line 133: Use `toJSON()` for safe escaping
- [ ] Verify no similar patterns in other workflow files
- [ ] Test changes locally if possible
- [ ] Commit and push for CI verification

## Rollback Plan

If issues occur:

1. Revert the commit
2. Re-analyze the escaping approach
3. Consider alternative approaches (base64, etc.)

## Success Criteria

- [ ] Workflow runs successfully with PR containing backticks
- [ ] Workflow runs successfully with PR containing quotes
- [ ] Workflow runs successfully with PR containing newlines
- [ ] Existing functionality preserved
