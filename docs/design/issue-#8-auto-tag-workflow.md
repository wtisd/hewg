# Design Document: Auto Tag Workflow

**Issue**: #8 - Add automatic tag creation workflow on PR merge with semantic
versioning **Created**: 2026-01-05 **Status**: Draft

## 1. Overview

This document describes the architecture and design for an automated Git tag
creation system that triggers on PR merge events. The system uses Semantic
Versioning and determines version increments based on branch labels.

## 2. Architecture

### 2.1 System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PR Merge Event (closed + merged)             │
│                    Target: main or develop                       │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    auto-tag.yml Workflow                         │
├─────────────────────────────────────────────────────────────────┤
│  Step 1: Checkout repository                                     │
│  Step 2: Read .github/project.toml configuration                │
│  Step 3: Get latest git tag (or default v0.0.0)                 │
│  Step 4: Extract label from source branch name                  │
│  Step 5: Parse current version                                   │
│  Step 6: Calculate new version based on:                        │
│          - Label → version increment type                        │
│          - Target branch → RC vs Release                         │
│  Step 7: Create and push new git tag                            │
│  Step 8: Comment on PR with new tag info                        │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Actions Runner                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────────────────────┐  │
│  │  Configuration   │    │        Version Calculator         │  │
│  │    Reader        │───▶│                                    │  │
│  │ (TOML Parser)    │    │  ┌────────────────────────────┐  │  │
│  └──────────────────┘    │  │   Label Extractor          │  │  │
│                          │  │   (branch → label)          │  │  │
│  ┌──────────────────┐    │  └────────────────────────────┘  │  │
│  │   Tag Fetcher    │───▶│  ┌────────────────────────────┐  │  │
│  │ (git describe)   │    │  │   Version Parser           │  │  │
│  └──────────────────┘    │  │   (semver parsing)         │  │  │
│                          │  └────────────────────────────┘  │  │
│                          │  ┌────────────────────────────┐  │  │
│                          │  │   Increment Calculator     │  │  │
│                          │  │   (MAJOR/MINOR/PATCH/RC)   │  │  │
│                          │  └────────────────────────────┘  │  │
│                          └──────────────────────────────────┘  │
│                                         │                        │
│                                         ▼                        │
│                          ┌──────────────────────────────────┐  │
│                          │         Tag Creator              │  │
│                          │   (git tag + git push)           │  │
│                          └──────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 3. Version Calculation Logic

### 3.1 Version Format

```
v{MAJOR}.{MINOR}.{PATCH}[-rc.{RC_NUMBER}]

Examples:
- v1.0.0        (release version)
- v1.2.3-rc.0   (release candidate)
- v2.0.0-rc.5   (release candidate for major version)
```

### 3.2 Label to Increment Mapping

| Label Category | Labels                             | Increment Type |
| -------------- | ---------------------------------- | -------------- |
| MAJOR          | `release`                          | X.0.0          |
| MINOR          | `feature`                          | 0.X.0          |
| PATCH          | `bugfix`, `fix`, `patch`, `hotfix` | 0.0.X          |
| RC only        | (all others)                       | -rc.X only     |

### 3.3 Branch Target Logic

| Target Branch | Source             | Action                            |
| ------------- | ------------------ | --------------------------------- |
| `develop`     | Any PR             | Create RC version                 |
| `main`        | Feature/bugfix PR  | Create release version            |
| `main`        | `develop` branch   | Strip RC suffix, create release   |

### 3.4 Version Calculation Algorithm

```javascript
function calculateNewVersion(currentTag, label, targetBranch, sourceBranch) {
  const current = parseVersion(currentTag); // {major, minor, patch, rc}

  // Determine if this is a develop→main merge
  const isDevelopToMain = targetBranch === 'main' && sourceBranch === 'develop';

  if (isDevelopToMain) {
    // Strip RC suffix, keep version numbers
    return `v${current.major}.${current.minor}.${current.patch}`;
  }

  const incrementType = getIncrementType(label, config);

  if (targetBranch === 'develop') {
    // RC version for develop
    return calculateRCVersion(current, incrementType);
  } else {
    // Release version for main
    return calculateReleaseVersion(current, incrementType);
  }
}

function calculateRCVersion(current, incrementType) {
  if (incrementType === 'MAJOR') {
    return `v${current.major + 1}.0.0-rc.0`;
  } else if (incrementType === 'MINOR') {
    return `v${current.major}.${current.minor + 1}.0-rc.0`;
  } else if (incrementType === 'PATCH') {
    return `v${current.major}.${current.minor}.${current.patch + 1}-rc.0`;
  } else {
    // RC only - just increment RC counter
    const rcNum = (current.rc ?? -1) + 1;
    return `v${current.major}.${current.minor}.${current.patch}-rc.${rcNum}`;
  }
}

function calculateReleaseVersion(current, incrementType) {
  // Strip any RC suffix and apply increment
  if (incrementType === 'MAJOR') {
    return `v${current.major + 1}.0.0`;
  } else if (incrementType === 'MINOR') {
    return `v${current.major}.${current.minor + 1}.0`;
  } else {
    return `v${current.major}.${current.minor}.${current.patch + 1}`;
  }
}
```

## 4. Configuration Schema

### 4.1 project.toml [tag] Section

```toml
[tag]
# Labels that trigger MAJOR version increment (X.0.0)
major_labels = ["release"]

# Labels that trigger MINOR version increment (0.X.0)
minor_labels = ["feature"]

# Labels that trigger PATCH version increment (0.0.X)
patch_labels = ["bugfix", "fix", "patch", "hotfix"]

# All other labels trigger RC increment only
# This is implicit - no configuration needed
```

### 4.2 Configuration Defaults

| Setting          | Default Value                        |
| ---------------- | ------------------------------------ |
| `major_labels`   | `["release"]`                        |
| `minor_labels`   | `["feature"]`                        |
| `patch_labels`   | `["bugfix", "fix", "patch", "hotfix"]` |
| Initial version  | `v0.0.0`                             |

## 5. Error Handling

### 5.1 Error Scenarios

| Scenario            | Handling                        |
| ------------------- | ------------------------------- |
| No existing tags    | Use `v0.0.0` as base            |
| Invalid tag format  | Log warning, use `v0.0.0`       |
| Missing config file | Use default label mappings      |
| Unknown label       | Treat as RC-only increment      |
| Git push failure    | Fail workflow, comment on PR    |

### 5.2 PR Comments

**Success:**

```markdown
🏷️ **Tag Created**: `v1.2.0-rc.0`

- Previous: `v1.1.0`
- Label: `feature` (MINOR)
- Target: `develop`
```

**Failure:**

```markdown
⚠️ **Tag Creation Failed**

Error: {error_message}

[View workflow run]({run_url})
```

## 6. Security Considerations

### 6.1 Permissions

```yaml
permissions:
  contents: write  # Required to create and push tags
```

### 6.2 Token Requirements

- Uses `GITHUB_TOKEN` (automatically provided)
- No additional secrets required for tag creation
- `contents: write` permission must be granted

## 7. File Structure

```
.github/
├── project.toml          # Configuration (add [tag] section)
└── workflows/
    ├── auto-tag.yml      # New workflow
    ├── issue-to-project.yml
    └── pr-status-update.yml

src/templates/
├── auto-tag.yml          # Template for setup command
├── issue-to-project.yml
└── pr-status-update.yml
```

## 8. Integration Points

### 8.1 Existing Workflows

- **release.yml**: Will be deleted (functionality absorbed)
- **pr-status-update.yml**: Pattern reference for TOML parsing
- **issue-to-project.yml**: No direct integration

### 8.2 Branch Naming Convention

Leverages existing pattern: `{label}/{author}/{issue_number}/{title}`

Example: `feature/wtisd/8/auto-tag-workflow`

- Extracted label: `feature`
- Increment type: MINOR

## 9. Testing Strategy

### 9.1 Test Scenarios

| Scenario                 | Input                   | Expected Output  |
| ------------------------ | ----------------------- | ---------------- |
| First tag (no existing)  | feature PR → develop    | `v0.1.0-rc.0`    |
| Feature to develop       | v1.0.0, feature PR      | `v1.1.0-rc.0`    |
| Bugfix to develop        | v1.1.0-rc.0, bugfix PR  | `v1.1.1-rc.0`    |
| RC increment             | v1.1.0-rc.0, docs PR    | `v1.1.0-rc.1`    |
| Develop to main          | v1.1.0-rc.3             | `v1.1.0`         |
| Hotfix to main           | v1.1.0, hotfix PR       | `v1.1.1`         |
| Release to main          | v1.1.0, release PR      | `v2.0.0`         |

### 9.2 Manual Testing

1. Create test branches with different labels
2. Open PRs to develop/main
3. Merge and verify tag creation
4. Check PR comments

## 10. Future Considerations

- **Release notes generation**: Auto-generate changelog from commits
- **Notification integration**: Slack/Discord notifications on release
- **Version file updates**: Auto-update deno.json version field
- **Protected tags**: Tag protection rules for releases
