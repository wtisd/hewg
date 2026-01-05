# Implementation Workflow: Auto Tag Workflow

**Issue**: #8 - Add automatic tag creation workflow on PR merge with semantic versioning
**Created**: 2026-01-05
**Design Document**: [issue-#8-auto-tag-workflow.md](../design/issue-#8-auto-tag-workflow.md)

## Phase Overview

| Phase | Description | Dependencies |
|-------|-------------|--------------|
| 1 | Core Workflow Creation | None |
| 2 | Configuration Update | Phase 1 |
| 3 | Template Creation | Phase 1 |
| 4 | Cleanup | Phase 1-3 |
| 5 | Testing & Verification | Phase 1-4 |

---

## Phase 1: Core Workflow Creation

### Task 1.1: Create auto-tag.yml workflow file

**File**: `.github/workflows/auto-tag.yml`

**Steps**:
1. Create workflow file with PR merge trigger
2. Implement TOML parser (reuse from pr-status-update.yml)
3. Implement version parsing function
4. Implement label extraction function
5. Implement version calculation logic
6. Implement tag creation and push
7. Implement PR comment functionality

**Acceptance Criteria**:
- [ ] Workflow triggers on PR merge to main/develop
- [ ] Correctly parses project.toml configuration
- [ ] Extracts label from branch name
- [ ] Calculates correct version based on rules
- [ ] Creates and pushes git tag
- [ ] Comments on PR with result

### Task 1.2: Version Calculation Functions

**Functions to implement**:

```javascript
// Parse version string into components
function parseVersion(tag) {
  // Input: "v1.2.3-rc.4" or "v1.2.3"
  // Output: { major: 1, minor: 2, patch: 3, rc: 4 or null }
}

// Get increment type from label
function getIncrementType(label, config) {
  // Returns: 'MAJOR', 'MINOR', 'PATCH', or 'RC_ONLY'
}

// Calculate new version
function calculateNewVersion(current, incrementType, targetBranch, isDevelopToMain) {
  // Returns: new version string
}
```

---

## Phase 2: Configuration Update

### Task 2.1: Update project.toml

**File**: `.github/project.toml`

**Changes**:
```toml
[tag]
major_labels = ["release"]
minor_labels = ["feature"]
patch_labels = ["bugfix", "fix", "patch", "hotfix"]
```

**Acceptance Criteria**:
- [ ] [tag] section added to project.toml
- [ ] Default labels configured
- [ ] Comments added for documentation

---

## Phase 3: Template Creation

### Task 3.1: Create auto-tag.yml template

**File**: `src/templates/auto-tag.yml`

**Steps**:
1. Copy workflow from .github/workflows/auto-tag.yml
2. Add template header comments
3. Ensure consistent with other templates

**Acceptance Criteria**:
- [ ] Template file created
- [ ] Header comments match other templates
- [ ] Symlink or reference working

---

## Phase 4: Cleanup

### Task 4.1: Delete release.yml

**Files to delete**:
- `.github/workflows/release.yml`

**Acceptance Criteria**:
- [ ] release.yml deleted
- [ ] No broken references

---

## Phase 5: Testing & Verification

### Task 5.1: Lint and Format Check

```bash
deno fmt --check
deno lint
```

### Task 5.2: Scenario Testing

| Test Case | Branch | Target | Expected Tag |
|-----------|--------|--------|--------------|
| No existing tags + feature | feature/test/1/x | develop | v0.1.0-rc.0 |
| Existing v1.0.0 + feature | feature/test/2/x | develop | v1.1.0-rc.0 |
| Existing v1.1.0-rc.0 + bugfix | bugfix/test/3/x | develop | v1.1.1-rc.0 |
| Existing v1.1.0-rc.0 + docs | docs/test/4/x | develop | v1.1.0-rc.1 |
| Develop to main merge | develop | main | v1.1.0 (strip rc) |
| Direct hotfix to main | hotfix/test/5/x | main | v1.0.1 |

---

## Commit Strategy

### Commit 1: Design and Workflow Documents
```
📝 docs: add design and workflow documents for auto-tag feature

- Add docs/design/issue-#8-auto-tag-workflow.md
- Add docs/workflow/issue-#8-auto-tag-workflow.md
```

### Commit 2: Core Workflow
```
✨ feat: add auto-tag workflow for semantic versioning

- Create .github/workflows/auto-tag.yml
- Implement version calculation logic
- Add PR comment on tag creation
```

### Commit 3: Configuration
```
🔧 config: add [tag] section to project.toml

- Add major_labels, minor_labels, patch_labels configuration
- Document default behavior for unknown labels
```

### Commit 4: Template
```
✨ feat: add auto-tag.yml template

- Create src/templates/auto-tag.yml for setup command
```

### Commit 5: Cleanup
```
🔥 chore: remove release.yml (replaced by auto-tag)

- Delete .github/workflows/release.yml
- Functionality absorbed into auto-tag workflow
```

---

## Rollback Plan

If issues are discovered after merge:

1. **Immediate**: Disable workflow by renaming file
2. **Short-term**: Revert merge commit
3. **Manual tagging**: Can always create tags manually

---

## Dependencies

### External Dependencies
- `actions/checkout@v4`
- `actions/github-script@v7`

### Internal Dependencies
- `.github/project.toml` must exist
- Branch naming convention must be followed

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Wrong version calculation | Low | Medium | Comprehensive testing |
| Tag push failure | Low | Low | Error handling + PR comment |
| Config file missing | Low | Low | Default values fallback |
| Race condition (concurrent merges) | Low | Medium | Git handles tag conflicts |
