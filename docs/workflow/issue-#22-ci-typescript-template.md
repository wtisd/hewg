# Workflow: TypeScript/Deno CI Template Implementation

**Issue**: #22 - Add TypeScript/Deno CI workflow template with categorized test execution

## Implementation Phases

### Phase 1: Template Creation

**Goal**: Create the base `ci-typescript.yml` template

#### Task 1.1: Create template file
- File: `src/templates/ci-typescript.yml`
- Add workflow name and triggers (pull_request, push, workflow_dispatch)
- Configure workflow_dispatch inputs for e2e flag

#### Task 1.2: Implement check job
- Add checkout step
- Add Deno setup step
- Add formatter check (`deno fmt --check`)
- Add linter (`deno lint`)
- Add type check (`deno check`)

#### Task 1.3: Implement test-unit job
- Configure job dependency on check
- Add test execution for `tests/unit/`
- Add coverage generation
- Add coverage artifact upload

### Phase 2: Conditional Execution

**Goal**: Implement conditional job execution

#### Task 2.1: Implement test-integration job
- Add conditional: `github.event_name == 'push' || github.event_name == 'workflow_dispatch'`
- Configure job dependency on test-unit
- Add test execution for `tests/integration/`
- Add coverage generation
- Add coverage artifact upload

#### Task 2.2: Implement test-e2e job
- Add conditional: `github.event_name == 'workflow_dispatch' && inputs.run_e2e`
- Configure job dependency on check only
- Add test execution for `tests/e2e/`
- No coverage (E2E tests are for validation, not coverage)

#### Task 2.3: Implement coverage merge and upload
- Add job to download coverage artifacts
- Merge unit and integration coverage
- Upload to Codecov

### Phase 3: CLI Integration

**Goal**: Integrate template into setup-actions command

#### Task 3.1: Update setup-actions.ts
- Add `--ci` flag definition
- Add CI template copy logic
- Update help text and next steps output

#### Task 3.2: Verify integration
- Test `hewg setup-actions --ci`
- Test combined `hewg setup-actions --ci --project-url <url>`
- Verify file creation

## Task Breakdown

| # | Task | Files | Dependencies |
|---|------|-------|--------------|
| 1 | Create ci-typescript.yml with triggers | `src/templates/ci-typescript.yml` | - |
| 2 | Add check job | `src/templates/ci-typescript.yml` | 1 |
| 3 | Add test-unit job | `src/templates/ci-typescript.yml` | 2 |
| 4 | Add test-integration job | `src/templates/ci-typescript.yml` | 3 |
| 5 | Add test-e2e job | `src/templates/ci-typescript.yml` | 4 |
| 6 | Add coverage job | `src/templates/ci-typescript.yml` | 5 |
| 7 | Add --ci flag to setup-actions.ts | `src/cli/commands/setup-actions.ts` | 6 |
| 8 | Add CI template copy logic | `src/cli/commands/setup-actions.ts` | 7 |
| 9 | Update output messages | `src/cli/commands/setup-actions.ts` | 8 |

## Testing Strategy

### Unit Tests
- Test flag parsing for `--ci`
- Test template file existence check

### Integration Tests
- Test full `setup-actions --ci` command execution
- Verify generated files match templates

### Manual Verification
- Run `deno task setup:actions --ci` in a test directory
- Verify workflow file structure
- Test workflow in GitHub Actions (if possible)

## Rollback Plan

If issues are discovered:
1. Revert the commit
2. Templates in `src/templates/` are isolated - no impact on existing workflows
3. CLI flag addition is backward compatible

## Completion Criteria

- [ ] `src/templates/ci-typescript.yml` created and functional
- [ ] All jobs (check, test-unit, test-integration, test-e2e, coverage) implemented
- [ ] Conditional execution working correctly
- [ ] `setup-actions.ts` updated with `--ci` flag
- [ ] All tests passing
- [ ] Code formatted and linted
