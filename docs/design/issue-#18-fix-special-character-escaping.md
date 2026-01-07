# Design: Fix Special Character Escaping in pr-status-update Workflow

## Issue

- **Issue**: #18
- **Type**: Bug Fix
- **Status**: In Progress

## Problem Statement

The `pr-status-update.yml` workflow fails when PR body contains special characters (backticks, quotes) that conflict with JavaScript template literals or shell quoting.

### Root Cause

```yaml
# Line 133 - JavaScript template literal breaks with backticks in PR body
const prBody = `${{ github.event.pull_request.body }}`;
```

When PR body contains `` `code` ``, the resulting JavaScript becomes:

```javascript
const prBody = `Some text `code` more text`;
//                        ^ template literal ends here
```

## Solution Design

### Approach: Use `toJSON()` Function

GitHub Actions' `toJSON()` function safely serializes values to JSON strings, properly escaping all special characters.

### Affected Locations

| Line | Type  | Current                                                | After                                |
| ---- | ----- | ------------------------------------------------------ | ------------------------------------ |
| 53   | Shell | `body_content='${{ github.event.pull_request.body }}'` | Environment variable with `toJSON()` |
| 133  | JS    | `` const prBody = `${{ ... }}` ``                      | `JSON.parse(${{ toJSON(...) }})`     |

### Fix Pattern

**For JavaScript (`actions/github-script`):**

```javascript
// Before
const prBody = `${{ github.event.pull_request.body }}`;

// After
const prBody = ${{ toJSON(github.event.pull_request.body) }};
// Note: toJSON() already produces a valid JS string literal with quotes
```

**For Shell:**

```yaml
# Before
body_content='${{ github.event.pull_request.body }}'

# After - Use environment variable
env:
  PR_BODY: ${{ github.event.pull_request.body }}
run: |
  body_content="$PR_BODY"
```

## Security Considerations

- `toJSON()` escapes all special characters, preventing injection attacks
- Environment variables are safer than inline substitution for shell scripts
- No user input is directly executed as code

## Testing Strategy

- Create a PR with backticks, quotes, and newlines in the body
- Verify workflow completes successfully
- Verify Issue status is updated correctly
