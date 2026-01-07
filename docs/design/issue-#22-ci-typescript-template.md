# Design: TypeScript/Deno CI Workflow Template

**Issue**: #22 - Add TypeScript/Deno CI workflow template with categorized test execution

## Overview

This document describes the architecture and design decisions for the TypeScript/Deno CI workflow template (`ci-typescript.yml`).

## Architecture

### Workflow Structure

```
ci-typescript.yml
├── Triggers
│   ├── pull_request (PR creation/update)
│   ├── push (merge to main/develop)
│   └── workflow_dispatch (manual with e2e option)
│
├── Jobs
│   ├── check (always runs)
│   │   ├── deno fmt --check
│   │   ├── deno lint
│   │   └── deno check
│   │
│   ├── test-unit (PR + merge)
│   │   └── tests/unit/**/*.ts
│   │
│   ├── test-integration (merge only)
│   │   └── tests/integration/**/*.ts
│   │
│   └── test-e2e (manual only)
│       └── tests/e2e/**/*.ts
│
└── Coverage
    └── Unit + Integration → Codecov
```

### Job Dependency Graph

```
┌─────────┐
│  check  │
└────┬────┘
     │
     ▼
┌───────────┐    ┌────────────────┐
│ test-unit │───▶│test-integration│
└─────┬─────┘    └───────┬────────┘
      │                  │
      └────────┬─────────┘
               ▼
        ┌──────────────┐
        │   coverage   │
        └──────────────┘

┌─────────┐
│  check  │───▶┌──────────┐
└─────────┘    │ test-e2e │ (independent, manual only)
               └──────────┘
```

## Test Classification

| Type | Directory | Scope | Characteristics | Execution Timing |
|------|-----------|-------|-----------------|------------------|
| Unit | `tests/unit/` | Single module | Mocks, fast, isolated | Every PR |
| Integration | `tests/integration/` | Multiple modules | Internal connections | After merge |
| E2E | `tests/e2e/` | Full system | External APIs, real env | Manual only |

## Trigger Matrix

| Event | check | unit | integration | e2e |
|-------|:-----:|:----:|:-----------:|:---:|
| `pull_request` | ✓ | ✓ | - | - |
| `push` (merge) | ✓ | ✓ | ✓ | - |
| `workflow_dispatch` | ✓ | ✓ | ✓ | Optional |

## Conditional Execution Strategy

### Integration Tests
```yaml
if: github.event_name == 'push' || github.event_name == 'workflow_dispatch'
```
- Runs only on merge or manual dispatch
- Skipped during PR to reduce CI time

### E2E Tests
```yaml
if: github.event_name == 'workflow_dispatch' && inputs.run_e2e == true
```
- Manual trigger only
- Requires explicit opt-in via `run_e2e` input

## Coverage Strategy

### Combined Coverage
- Unit and Integration tests contribute to the same coverage report
- Coverage artifacts are uploaded from both jobs
- Final coverage is merged before Codecov upload

### Coverage Flow
```
test-unit (coverage/unit/) ─────┐
                                ├──▶ merge ──▶ Codecov
test-integration (coverage/int/)┘
```

## CLI Integration

### setup-actions.ts Extension

New flag: `--ci`
```bash
hewg setup-actions --ci
```

Creates:
- `.github/workflows/ci-typescript.yml`

Combined setup:
```bash
hewg setup-actions --ci --project-url <url>
```

Creates all workflows:
- `issue-to-project.yml`
- `pr-status-update.yml`
- `ci-typescript.yml`

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| No build job | Separation of concerns; build is a separate template |
| E2E manual only | External API dependencies; local execution preferred |
| Combined coverage | Accurate full codebase coverage measurement |
| Folder-based test classification | More intuitive than filename conventions |
| Optional E2E flag | Prevents accidental external API calls |

## Security Considerations

- No secrets required for basic CI operations
- E2E tests with external APIs should be run locally
- Coverage tokens (Codecov) are optional and gracefully handled

## Error Handling

- Each job fails independently
- Coverage upload failure does not fail the build (`fail_ci_if_error: false`)
- Clear error messages in workflow logs
