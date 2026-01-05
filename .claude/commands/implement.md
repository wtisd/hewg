# Claude Command: Implement

This command helps you implement GitHub Issues by reviewing requirements, creating branches, implementing features, adding tests, and ensuring code quality.

**Environment**: TypeScript/Deno

## Usage

To implement a GitHub Issue:

```
/implement <issue_number>
```

Example:

```
/implement 42
```

## What This Command Does

This command orchestrates a structured workflow by delegating to SuperClaude commands:

1. **Review GitHub Issue** - Use `gh issue view` to check and understand the issue content (including any documentation comments)
2. **Create feature branch** - Checkout a new branch from develop with the naming convention:
   - Format: `{label}/{assignee}/#{issue_number}/{title}`
   - Example: `feature/john/#42/user-authentication`
3. **Execute /sc:design** - Delegate to design skill for architecture and component specifications
4. **Execute /sc:workflow** - Delegate to workflow skill for implementation planning
5. **Break down tasks** - Organize implementation tasks based on design and workflow documents
6. **Execute /sc:implement** - Delegate actual implementation to the implement skill
7. **Commit progressively** - Create commits as each task or subtask is completed
8. **Execute /sc:test** - Delegate comprehensive testing with coverage analysis
9. **Execute /sc:analyze + /sc:improve** - Run quality checks and apply improvements
10. **Final commit** - Commit all remaining modifications (including design and workflow documents)
11. **Present results** - Show the final branch name and issue number to the user

## SuperClaude Command Delegation

| Phase          | Delegated Command | Purpose                                    |
| -------------- | ----------------- | ------------------------------------------ |
| Design         | `/sc:design`      | Architecture and component specifications  |
| Planning       | `/sc:workflow`    | Implementation workflow and task breakdown |
| Implementation | `/sc:implement`   | Feature and code implementation            |
| Testing        | `/sc:test`        | Execute tests with coverage analysis       |
| Analysis       | `/sc:analyze`     | Comprehensive code quality analysis        |
| Improvement    | `/sc:improve`     | Apply systematic code improvements         |

## Branch Naming Convention

Branches are created following this pattern:

```
{label}/{assignee}/#{issue_number}/{title}
```

Where:

- `{label}` - Issue label (feature, bugfix, patch, refactor, documentation)
- `{assignee}` - GitHub username of the assignee
- `{issue_number}` - The issue number (with # prefix)
- `{title}` - Kebab-case title derived from the issue

Examples:

- `feature/alice/#123/add-user-auth`
- `bugfix/bob/#456/fix-memory-leak`
- `refactor/charlie/#789/optimize-database-queries`

## Implementation Workflow

### 1. Issue Analysis

- Read and understand all requirements
- Check issue comments for documentation notes (from `/issue` command)
- Identify main tasks and subtasks
- Note acceptance criteria
- Check for dependencies

### 2. Design Phase (/sc:design)

Delegate to `/sc:design` skill to create comprehensive design document:

- Output file: `docs/design/issue-#{issue_number}-{title}.md`
- Contents:
  - Architecture overview and component structure
  - API design and interface definitions
  - Data models and database schema (if applicable)
  - Security considerations
  - Error handling strategy
- Commit design document before proceeding

### 3. Workflow Planning (/sc:workflow)

Delegate to `/sc:workflow` skill to create implementation workflow:

- Output file: `docs/workflow/issue-#{issue_number}-{title}.md`
- Contents:
  - Step-by-step implementation phases
  - Task breakdown with dependencies
  - Critical path identification
  - Testing strategy per phase
  - Rollback considerations
- Commit workflow document before proceeding

### 4. Development Process

Delegate to `/sc:implement` for actual implementation:

- Implement features incrementally **following the workflow document**
- Reference the design document for architecture decisions
- Follow existing code patterns and conventions
- Write clean, maintainable code
- Add appropriate comments and documentation
- **Use JSDoc/TSDoc comments** for all functions, classes, and modules

### 5. Commit Strategy

- Make atomic commits for each logical change
- Use conventional commit format with emojis
- Examples:
  - ✨ feat: implement user login endpoint
  - 🐛 fix: resolve validation error in signup
  - ♻️ refactor: extract authentication logic
  - ✅ test: add unit tests for auth service

### 6. Testing Requirements (/sc:test)

Delegate to `/sc:test` for comprehensive testing:

- Write unit tests for all new functions/methods
- Add integration tests for API endpoints
- Ensure edge cases are covered
- Target 100% coverage for C0 (statement) and C1 (branch)

```bash
# Run tests with coverage
deno test --coverage=coverage/

# Generate coverage report
deno coverage coverage/ --lcov > coverage/lcov.info
```

### 7. Documentation Standards

- **JSDoc/TSDoc comments**: Use for all functions, classes, and modules
- **Type annotations**: Include complete type annotations for parameters and return values
- **Examples**: Provide usage examples in JSDoc for complex functions
- **Module comments**: Include purpose and usage overview at module level
- **Design and Workflow documents**: Created automatically by `/sc:design` and `/sc:workflow` skills

#### Project Documentation Structure

See `docs/README.md` for the full documentation structure. Key directories:

- `docs/design/` - Architecture and design documents (created by `/sc:design`)
- `docs/workflow/` - Implementation workflow documents (created by `/sc:workflow`)
- `docs/adr/` - Architecture Decision Records

#### Document Naming Convention

- Design: `docs/design/issue-#{issue_number}-{title}.md`
- Workflow: `docs/workflow/issue-#{issue_number}-{title}.md`
- Example: `docs/design/issue-#42-user-authentication.md`

Example JSDoc/TSDoc format:

````typescript
/**
 * Brief description of what the function does.
 *
 * @param param1 - Description of the first parameter.
 * @param param2 - Description of the second parameter. Defaults to 0.
 * @returns Description of the return value.
 * @throws {Error} Description of when this exception is raised.
 *
 * @example
 * ```ts
 * const result = exampleFunction("test", 5);
 * console.log(result); // true
 * ```
 */
function exampleFunction(param1: string, param2: number = 0): boolean {
  return true;
}
````

### 8. Code Quality (/sc:analyze + /sc:improve)

Delegate to `/sc:analyze` and `/sc:improve`:

- **Linting**: Run `deno lint`
- **Formatting**: Run `deno fmt`
- **Type Checking**: Run `deno check **/*.ts` for type safety
- Fix all linting and type errors before proceeding

### 9. Final Verification

- Run full test suite via `/sc:test`
- Ensure no regressions
- Verify all issue requirements are met
- Confirm design and workflow documents are committed

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

If unable to complete implementation:

- Clearly communicate blockers to the user
- Ask for guidance on unresolved issues
- Document any assumptions made

## Output Format

Upon successful completion, the command will present:

```
✅ Implementation Complete

Branch: feature/username/#123/feature-title
Issue: #123

Documents Created:
- docs/design/issue-#123-feature-title.md
- docs/workflow/issue-#123-feature-title.md

SuperClaude Execution:
- /sc:design: Design document created
- /sc:workflow: Workflow document created
- /sc:implement: All tasks implemented
- /sc:test: Coverage XX%
- /sc:analyze: X issues found
- /sc:improve: X improvements applied

Summary:
- Design document created and committed
- Workflow document created and committed
- All tasks implemented
- Tests added (Coverage: X%)
- Lint and type checks passed
- All tests passing

Ready for review and merge.
```

## Best Practices

- **SuperClaude Delegation**: Leverage specialized commands for each phase
- **Incremental Development**: Build features step by step
- **Test-Driven Development**: Consider writing tests first when appropriate
- **Code Review Ready**: Ensure code is clean and well-documented
- **Continuous Integration**: Verify all CI checks would pass
- **Communication**: Keep the user informed of progress and any issues

## Integration with Other Commands

This command delegates to and combines:

- `/sc:design` - Architecture and design specifications
- `/sc:workflow` - Implementation planning
- `/sc:implement` - Feature implementation
- `/sc:test` - Test execution and coverage
- `/sc:analyze` - Code quality analysis
- `/sc:improve` - Code improvement

## Japanese Issue Support

このコマンドは日本語で書かれたGitHub Issueにも対応しています。実装時には：

- 日本語の要件を正確に理解
- 適切な英語のコード/コメントへの変換
- 必要に応じて日本語でのフィードバック提供
