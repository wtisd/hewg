# Claude Command: Bugfix

This command helps you fix bugs end-to-end: from understanding the issue, creating a GitHub Issue, implementing the fix, running quality checks, creating a Pull Request, and ensuring all GitHub Actions pass.

**Environment**: TypeScript/Deno

## Usage

To fix a bug:

```
/bugfix
```

Or with an existing issue number:

```
/bugfix <issue_number>
```

Example:

```
/bugfix 42
```

## What This Command Does

This command orchestrates a complete bug-fixing workflow by delegating to SuperClaude commands:

1. **Understand the bug** - Review and confirm the bug details with the user
2. **Create GitHub Issue** (if not provided) - Delegate to `/sc:git` for issue creation
3. **Create bugfix branch** - Checkout a new branch from develop
4. **Investigate with /sc:analyze** - Analyze root cause using code analysis
5. **Implement the fix** - Delegate to `/sc:implement` for the actual fix
6. **Execute /sc:test** - Run comprehensive tests with coverage analysis
7. **Execute /sc:improve** - Apply improvements based on analysis results
8. **Create bugfix documentation** - Generate `docs/bugfix/issue-{issue_number}-{title}.md`
9. **Commit and push** - Delegate to `/sc:git` for git operations
10. **Create Pull Request** - Delegate to `/pr` command for PR creation
11. **Verify GitHub Actions (loop)** - Poll CI status and fix any failures until all pass
12. **Report completion** - Present final summary to user

## SuperClaude Command Delegation

| Phase               | Delegated Command | Purpose                                        |
| ------------------- | ----------------- | ---------------------------------------------- |
| Root Cause Analysis | `/sc:analyze`     | Comprehensive code analysis to find bug source |
| Issue Creation      | `/sc:git`         | Git operations and GitHub issue management     |
| Implementation      | `/sc:implement`   | Feature and fix implementation                 |
| Testing             | `/sc:test`        | Execute tests with coverage analysis           |
| Code Improvement    | `/sc:improve`     | Apply systematic improvements                  |
| PR Creation         | `/pr`             | Pull Request workflow                          |

## Detailed Workflow

### Phase 1: Bug Understanding

1. **Confirm bug details** with the user:
   - What is the expected behavior?
   - What is the actual behavior?
   - Steps to reproduce
   - Environment/conditions where it occurs
   - Any error messages or logs

2. **Investigate the root cause** - Delegate to `/sc:analyze`:
   ```
   /sc:analyze --focus=bug --target=<suspected_files>
   ```
   - Search codebase for related code
   - Analyze potential causes
   - Identify affected components

### Phase 2: Issue Creation (if no issue number provided)

Delegate to `/sc:git` for GitHub Issue creation:

**Title (English):** `fix: {brief description of the bug}`

**Description (Japanese):**

```markdown
## バグ概要

バグの簡潔な説明

## 再現手順

1. Step 1
2. Step 2
3. ...

## 期待される動作

正常な動作の説明

## 実際の動作

発生しているバグの動作

## 環境

- OS:
- Deno version:
- Version:

## エラーログ
```

エラーメッセージやスタックトレース

```
## 原因分析
根本原因の推定

## 修正方針
修正アプローチの概要
```

**Issue Settings:**

- Label: `bugfix`
- Milestone: Set based on target container
- Assignee: Assign to user

### Phase 3: Branch Creation

Create a bugfix branch following the naming convention:

```
bugfix/{assignee}/#{issue_number}/{title}
```

Example:

```
bugfix/john/#123/fix-memory-leak
```

### Phase 4: Implementation

Delegate to `/sc:implement` for the fix implementation:

1. **Analyze root cause**:
   - Read relevant code sections
   - Understand the bug mechanism
   - Identify the exact location(s) to fix

2. **Implement the fix**:
   - Make minimal, focused changes
   - Follow existing code patterns
   - Add appropriate error handling
   - Avoid unnecessary refactoring

3. **Add tests** - Delegate to `/sc:test`:
   - Write regression tests that would have caught the bug
   - Ensure edge cases are covered
   - Target high coverage for affected code

4. **Progressive commits**:
   - Commit logical units of work
   - Use conventional commit format:
     - `🐛 fix: {description}`
     - `✅ test: add regression tests for {bug}`

### Phase 5: Code Quality (/sc:analyze + /sc:improve)

1. **Execute `/sc:analyze`** on changed files:
   - Quality analysis (code style, complexity)
   - Security analysis (vulnerability check)
   - Performance analysis (no regression)
   - Architecture analysis (design patterns)

2. **Execute `/sc:test`** for comprehensive testing:
   ```bash
   deno test --coverage=coverage/
   deno coverage coverage/ --lcov > coverage/lcov.info
   ```

3. **Execute `/sc:improve`**:
   - Fix identified issues
   - Apply code quality improvements
   - Optimize if necessary

4. **Commit improvements**:
   ```bash
   git add .
   git commit -m "♻️ refactor: apply code improvements from analysis"
   ```

### Phase 6: Documentation

Create bugfix documentation at `docs/bugfix/issue-{issue_number}-{title}.md`:

````markdown
# Bugfix: {Issue Title}

## Issue Information

- **Issue**: #{issue_number}
- **Date**: {date}
- **Author**: {assignee}

## Bug Summary

バグの概要説明

## Root Cause Analysis

### 発生箇所

- ファイル: `path/to/file.ts`
- 行番号: XX-YY
- 関連コンポーネント: ComponentName

### 原因

根本原因の詳細説明

### 影響範囲

影響を受けた機能や範囲

## Solution

### 修正アプローチ

採用した修正方法の説明

### 変更内容

| ファイル          | 変更内容   |
| ----------------- | ---------- |
| `path/to/file.ts` | 変更の説明 |

### コード変更

```diff
- 変更前のコード
+ 変更後のコード
```
````

## Prevention

### 再発防止策

- 追加したテスト
- 今後の注意点

### 関連改善

- コードレビューポイント
- 設計改善の提案（あれば）

## Testing

### 追加したテスト

- テスト1の説明
- テスト2の説明

### テスト結果

- 全テスト: Pass
- カバレッジ: XX%

## Lessons Learned

今回の修正で学んだこと、チームで共有すべき知見

````
**Commit documentation**:
```bash
git add docs/bugfix/
git commit -m "📝 docs: add bugfix documentation for #XXX"
````

### Phase 7: Push and Pull Request

Delegate to `/pr` command for complete PR workflow:

1. **Push changes**:
   ```bash
   git push origin bugfix/{assignee}/#{issue_number}/{title}
   ```

2. **Create Pull Request** - The `/pr` command will handle:
   - Code analysis (/sc:analyze)
   - Code improvement (/sc:improve)
   - PR creation with proper description
   - GitHub Actions verification loop

### Phase 8: GitHub Actions Verification (Loop)

Poll GitHub Actions status until all checks pass:

```bash
while true; do
  gh pr checks <PR_NUMBER>

  # If all pass → exit loop
  # If running → sleep 30s and retry
  # If failed → fix locally, commit, push, re-check

  sleep 30
done
```

**Common fixes (Deno environment):**

- **Format**: `deno fmt`
- **Lint**: `deno lint`
- **Type Check**: `deno check **/*.ts`
- **Tests**: `deno test`

### Phase 9: Report

**Present completion report**:

```
✅ Bugfix完了

Issue: #XXX - {title}
PR: #YYY
Branch: bugfix/{assignee}/#XXX/{title}

修正内容:
- 根本原因: {cause}
- 修正方法: {solution}
- 追加テスト: X件

SuperClaude実行結果:
- /sc:analyze: X件の問題を検出
- /sc:implement: 修正完了
- /sc:test: カバレッジ XX%
- /sc:improve: X件の改善を適用

GitHub Actions:
- ✅ deno fmt: passed
- ✅ deno lint: passed
- ✅ deno check: passed
- ✅ deno test: passed

ドキュメント:
- docs/bugfix/issue-#XXX-{title}.md

レビュー準備完了です。
```

## Deno-Specific Commands

| Task               | Command                          |
| ------------------ | -------------------------------- |
| Format             | `deno fmt`                       |
| Lint               | `deno lint`                      |
| Type Check         | `deno check **/*.ts`             |
| Test               | `deno test`                      |
| Test with Coverage | `deno test --coverage=coverage/` |
| Coverage Report    | `deno coverage coverage/`        |
| Run Task           | `deno task <task_name>`          |

## Error Handling

- **Cannot reproduce bug**: Ask user for more details
- **Root cause unclear**: Document investigation and ask for guidance
- **Fix causes regression**: Revert and try alternative approach
- **CI failures persist**: Report to user with detailed error information

## Best Practices

- **Minimal changes**: Fix only what's necessary
- **Regression tests**: Always add tests that would have caught the bug
- **Root cause focus**: Don't just fix symptoms
- **Documentation**: Record learnings for future reference
- **SuperClaude delegation**: Leverage specialized commands for each phase

## Directory Structure

Bugfix documentation is stored in:

```
docs/
└── bugfix/
    ├── issue-#123-fix-login-error.md
    ├── issue-#456-memory-leak-fix.md
    └── ...
```

## Integration with Other Commands

This command delegates to and combines:

- `/sc:analyze` - Root cause analysis and code quality
- `/sc:implement` - Implementation workflow
- `/sc:test` - Test execution and coverage
- `/sc:improve` - Code improvement
- `/sc:git` - Git operations
- `/pr` - Pull Request creation workflow

## Japanese Support

このコマンドは日本語でのバグ報告にも対応しています：

- 日本語でバグの詳細を説明可能
- Issue/PRの説明文は日本語で作成
- ドキュメントも日本語で記録
- タイトルは国際的な可読性のため英語
