# hewg

A versatile CLI framework for Deno.

## Features

- Subcommand support with aliases
- Positional arguments with defaults
- Boolean and value flags
- Auto-generated help messages with color output
- Semantic color utilities for terminal styling
- TypeScript-first with full type safety
- Zero external dependencies (uses Deno standard library only)
- Cross-platform binary compilation

## Installation

### As a module

```ts
import { createCli } from 'jsr:@erdtree/hewg';
```

### As a CLI tool

```bash
# Run directly
deno run --allow-read --allow-env https://jsr.io/@erdtree/hewg/src/main.ts

# Or compile to binary
deno compile --allow-read --allow-env --output hewg src/main.ts
```

## Quick Start

```ts
import { createCli } from '@erdtree/hewg';

const cli = createCli({
  name: 'my-tool',
  version: '1.0.0',
  description: 'My awesome CLI tool',
});

cli.register({
  name: 'greet',
  description: 'Greet someone',
  args: [
    { name: 'name', description: 'Name to greet', required: true },
  ],
  flags: [
    { short: 'l', long: 'loud', description: 'Shout the greeting' },
  ],
  action: (ctx) => {
    let message = `Hello, ${ctx.args.name}!`;
    if (ctx.flags.loud) {
      message = message.toUpperCase();
    }
    console.log(message);
  },
});

await cli.run(Deno.args);
```

## Usage

### Defining Commands

```ts
import type { Command } from '@erdtree/hewg';

const myCommand: Command = {
  name: 'example',
  description: 'An example command',
  aliases: ['ex', 'e'],
  args: [
    {
      name: 'input',
      description: 'Input file path',
      required: true,
    },
    {
      name: 'output',
      description: 'Output file path',
      default: 'output.txt',
    },
  ],
  flags: [
    {
      short: 'v',
      long: 'verbose',
      description: 'Enable verbose output',
      takesValue: false,
    },
    {
      short: 'f',
      long: 'format',
      description: 'Output format',
      takesValue: true,
      default: 'json',
    },
  ],
  action: async (ctx) => {
    console.log('Args:', ctx.args);
    console.log('Flags:', ctx.flags);
  },
};
```

### Built-in Commands

The CLI framework includes two sample commands:

#### hello

```bash
hewg hello [name] [--loud] [--count <n>]
```

#### version

```bash
hewg version [--json]
```

## Color Output

hewg includes built-in color utilities for consistent terminal styling:

```ts
import { colors } from '@erdtree/hewg';

// Semantic message formatting
console.log(colors.success('Operation completed!')); // Green
console.log(colors.error('Something went wrong')); // Bold red
console.log(colors.warn('Deprecated feature')); // Yellow
console.log(colors.info('Information message')); // Cyan

// Text styling
console.log(colors.highlight('Important')); // Bold cyan
console.log(colors.muted('Secondary info')); // Dim

// CLI-specific formatting
console.log(colors.command('help')); // Cyan (for command names)
console.log(colors.flag('--verbose')); // Yellow (for flags)
console.log(colors.argument('<file>')); // Dim (for placeholders)
console.log(colors.header('USAGE:')); // Bold (for section headers)
```

### Color Scheme

| Function    | Color     | Use Case                        |
| ----------- | --------- | ------------------------------- |
| `success`   | Green     | Success messages, confirmations |
| `error`     | Bold Red  | Error messages, failures        |
| `warn`      | Yellow    | Warnings, cautions              |
| `info`      | Cyan      | Informational messages          |
| `highlight` | Bold Cyan | Emphasized text                 |
| `muted`     | Dim       | Secondary information           |
| `command`   | Cyan      | Command names in help           |
| `flag`      | Yellow    | Flag names (--flag)             |
| `argument`  | Dim       | Argument placeholders           |
| `header`    | Bold      | Section headers                 |

## Development

### Prerequisites

- [Deno](https://deno.land/) v2.x or later

### Tasks

```bash
# Run in development mode with watch
deno task dev

# Run tests
deno task test

# Run tests with coverage
deno task test:coverage

# Run linter
deno task lint

# Format code
deno task fmt

# Type check
deno task check

# Run full CI checks
deno task ci

# Compile to binary
deno task compile
```

### Project Structure

```
hewg/
├── deno.json              # Deno configuration
├── src/
│   ├── mod.ts             # Main module exports
│   ├── main.ts            # CLI entry point
│   ├── version.ts         # Version constant
│   └── cli/
│       ├── mod.ts         # CLI module exports
│       ├── cli.ts         # Core CLI class
│       ├── colors.ts      # Color utilities
│       ├── types.ts       # Type definitions
│       └── commands/
│           ├── mod.ts     # Command exports
│           ├── hello.ts   # Hello command
│           └── version.ts # Version command
├── tests/
│   ├── cli_test.ts        # CLI tests
│   ├── colors_test.ts     # Color utilities tests
│   ├── commands_test.ts   # Command tests
│   └── mod_test.ts        # Module export tests
└── .github/
    └── workflows/
        ├── ci.yml         # CI workflow
        └── release.yml    # Release workflow
```

## GitHub Actions

This project includes CI/CD workflows:

- **CI**: Runs on every push/PR to main/develop
  - Format check (`deno fmt --check`)
  - Lint (`deno lint`)
  - Type check (`deno check`)
  - Tests with coverage

- **Release**: Triggered on version tags (v*)
  - Builds binaries for Linux, macOS, and Windows
  - Creates GitHub release with artifacts

### Issue-to-Project Automation

Automatically link new Issues to your GitHub Project:

```bash
deno task setup:actions
```

This creates:
- `.github/workflows/issue-to-project.yml` - GitHub Actions workflow
- `.github/project.toml` - Project configuration

#### Configuration

1. **Create a Personal Access Token (PAT)**
   - Go to GitHub Settings > Developer settings > Personal access tokens
   - Create a token with `project` scope

2. **Add repository secret**
   - Go to your repository Settings > Secrets and variables > Actions
   - Add a new secret named `PROJECT_TOKEN` with your PAT

3. **Configure project settings** (`.github/project.toml`)
   ```toml
   [project]
   url = "https://github.com/users/YOUR_USERNAME/projects/YOUR_PROJECT_NUMBER"

   [defaults]
   status = "Planned"
   priority = "P1"
   # iteration = "Sprint 1"
   # size = 3
   ```

#### Available Default Fields

| Field | Type | Example Values |
|-------|------|----------------|
| `status` | string | `Planned`, `Ready`, `In Progress`, `In Review`, `Done` |
| `priority` | string | `P0`, `P1`, `P2` |
| `iteration` | string | Sprint/iteration name |
| `size` | number | Story points or size estimate |
| `estimate` | number | Time estimate |
| `start_date` | date | `2026-01-05` (YYYY-MM-DD) |
| `target_date` | date | `2026-01-12` (YYYY-MM-DD) |

## API Reference

### `createCli(config: CliConfig): Cli`

Creates a new CLI instance.

```ts
interface CliConfig {
  name: string;
  version: string;
  description?: string;
}
```

### `Cli.register(command: Command): this`

Registers a command with the CLI.

### `Cli.run(args: string[]): Promise<void>`

Runs the CLI with the given arguments.

### Command Interface

```ts
interface Command {
  name: string;
  description?: string;
  aliases?: string[];
  args?: ArgOption[];
  flags?: FlagOption[];
  hidden?: boolean;
  action?: (ctx: CommandContext) => void | Promise<void>;
}
```

## License

MIT
