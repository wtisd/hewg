/**
 * Core CLI implementation
 */

import { parseArgs } from '@std/cli/parse-args';
import type { CliConfig, Command, CommandContext, ParseResult } from './types.ts';
import * as colors from './colors.ts';

/**
 * CLI framework class
 *
 * Provides a structured way to build command-line interfaces with
 * subcommands, flags, and arguments.
 */
export class Cli {
  private config: CliConfig;
  private commands: Map<string, Command> = new Map();
  private aliases: Map<string, string> = new Map();

  constructor(config: CliConfig) {
    this.config = config;
  }

  /**
   * Register a command with the CLI
   */
  register(command: Command): this {
    this.commands.set(command.name, command);

    // Register aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.set(alias, command.name);
      }
    }

    return this;
  }

  /**
   * Get a registered command by name or alias
   */
  getCommand(name: string): Command | undefined {
    const resolvedName = this.aliases.get(name) ?? name;
    return this.commands.get(resolvedName);
  }

  /**
   * Get all registered commands
   */
  getCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * Parse command line arguments
   */
  parse(args: string[]): ParseResult {
    const result: ParseResult = {
      command: null,
      args: {},
      flags: {},
      remaining: [],
      errors: [],
    };

    if (args.length === 0) {
      return result;
    }

    // Check if first arg is a command
    const commandName = args[0];
    const command = this.getCommand(commandName);

    if (command) {
      result.command = command;
      const commandArgs = args.slice(1);

      // Build flag options for parseArgs
      const booleanFlags: string[] = [];
      const stringFlags: string[] = [];
      const flagAliases: Record<string, string> = {};
      const defaults: Record<string, string | boolean> = {};

      if (command.flags) {
        for (const flag of command.flags) {
          if (flag.takesValue) {
            stringFlags.push(flag.long);
          } else {
            booleanFlags.push(flag.long);
          }

          if (flag.short) {
            flagAliases[flag.short] = flag.long;
          }

          if (flag.default !== undefined) {
            defaults[flag.long] = flag.default;
          }
        }
      }

      // Parse flags
      const parsed = parseArgs(commandArgs, {
        boolean: booleanFlags,
        string: stringFlags,
        alias: flagAliases,
        default: defaults,
      });

      // Extract positional args
      const positional = parsed._ as string[];
      if (command.args) {
        for (let i = 0; i < command.args.length; i++) {
          const argDef = command.args[i];
          result.args[argDef.name] = positional[i]?.toString() ?? argDef.default;

          if (argDef.required && result.args[argDef.name] === undefined) {
            result.errors.push(`Missing required argument: ${argDef.name}`);
          }
        }
      }

      // Extract flags
      for (const key of Object.keys(parsed)) {
        if (key !== '_') {
          result.flags[key] = parsed[key] as string | boolean;
        }
      }

      // Check required flags
      if (command.flags) {
        for (const flag of command.flags) {
          if (flag.required && result.flags[flag.long] === undefined) {
            result.errors.push(`Missing required flag: --${flag.long}`);
          }
        }
      }

      result.remaining = positional.slice(command.args?.length ?? 0).map(String);
    } else {
      // No command matched, treat as global flags
      const parsed = parseArgs(args, {
        boolean: ['help', 'version'],
        alias: { h: 'help', v: 'version', V: 'version' },
      });

      result.flags = {
        help: parsed.help as boolean,
        version: parsed.version as boolean,
      };
      result.remaining = (parsed._ as string[]).map(String);
    }

    return result;
  }

  /**
   * Run the CLI with the given arguments
   */
  async run(args: string[]): Promise<void> {
    const parsed = this.parse(args);

    // Handle global --help
    if (parsed.flags.help && !parsed.command) {
      this.showHelp();
      return;
    }

    // Handle global --version
    if (parsed.flags.version && !parsed.command) {
      console.log(`${this.config.name} ${this.config.version}`);
      return;
    }

    // No command specified
    if (!parsed.command) {
      if (args.length > 0 && !args[0].startsWith('-')) {
        console.error(colors.error(`Unknown command: ${args[0]}`));
        console.error(colors.muted(`Run '${this.config.name} --help' for usage.`));
        Deno.exit(1);
      }
      this.showHelp();
      return;
    }

    // Handle command --help
    if (parsed.flags.help) {
      this.showCommandHelp(parsed.command);
      return;
    }

    // Check for parsing errors
    if (parsed.errors.length > 0) {
      for (const err of parsed.errors) {
        console.error(colors.error(`Error: ${err}`));
      }
      console.error(
        colors.muted(`\nRun '${this.config.name} ${parsed.command.name} --help' for usage.`),
      );
      Deno.exit(1);
    }

    // Execute command
    if (parsed.command.action) {
      const context: CommandContext = {
        args: parsed.args,
        flags: parsed.flags,
        rawArgs: args,
        config: this.config,
      };

      try {
        await parsed.command.action(context);
      } catch (err) {
        console.error(colors.error(`Error executing command: ${err}`));
        Deno.exit(1);
      }
    }
  }

  /**
   * Show global help message
   */
  private showHelp(): void {
    console.log(colors.highlight(`${this.config.name} ${this.config.version}`));
    if (this.config.description) {
      console.log(`\n${this.config.description}`);
    }

    console.log(`\n${colors.header('USAGE:')}`);
    console.log(`  ${colors.command(this.config.name)} ${colors.argument('<command>')} [options]`);

    console.log(`\n${colors.header('COMMANDS:')}`);
    const visibleCommands = this.getCommands().filter((cmd) => !cmd.hidden);
    const maxNameLen = Math.max(...visibleCommands.map((cmd) => cmd.name.length));

    for (const cmd of visibleCommands) {
      const padding = ' '.repeat(maxNameLen - cmd.name.length + 2);
      console.log(`  ${colors.command(cmd.name)}${padding}${cmd.description ?? ''}`);
    }

    console.log(`\n${colors.header('OPTIONS:')}`);
    console.log(`  ${colors.flag('-h, --help')}      Show this help message`);
    console.log(`  ${colors.flag('-v, --version')}   Show version information`);

    console.log(
      colors.muted(
        `\nRun '${this.config.name} <command> --help' for more information on a command.`,
      ),
    );
  }

  /**
   * Show help for a specific command
   */
  private showCommandHelp(command: Command): void {
    console.log(colors.highlight(`${this.config.name} ${command.name}`));
    if (command.description) {
      console.log(`\n${command.description}`);
    }

    // Build usage string
    let usage = `  ${colors.command(this.config.name)} ${colors.command(command.name)}`;
    if (command.args) {
      for (const arg of command.args) {
        usage += arg.required
          ? ` ${colors.argument(`<${arg.name}>`)}`
          : ` ${colors.argument(`[${arg.name}]`)}`;
      }
    }
    if (command.flags && command.flags.length > 0) {
      usage += ` ${colors.argument('[options]')}`;
    }

    console.log(`\n${colors.header('USAGE:')}`);
    console.log(usage);

    if (command.args && command.args.length > 0) {
      console.log(`\n${colors.header('ARGUMENTS:')}`);
      const maxArgLen = Math.max(...command.args.map((arg) => arg.name.length));
      for (const arg of command.args) {
        const padding = ' '.repeat(maxArgLen - arg.name.length + 2);
        const required = arg.required ? colors.muted(' (required)') : '';
        const defaultVal = arg.default ? colors.muted(` [default: ${arg.default}]`) : '';
        console.log(
          `  ${colors.info(arg.name)}${padding}${arg.description ?? ''}${required}${defaultVal}`,
        );
      }
    }

    if (command.flags && command.flags.length > 0) {
      console.log(`\n${colors.header('OPTIONS:')}`);
      const flagStrings = command.flags.map((flg) => {
        const short = flg.short ? `-${flg.short}, ` : '    ';
        const value = flg.takesValue ? ` ${colors.argument('<value>')}` : '';
        return `${colors.flag(`${short}--${flg.long}`)}${value}`;
      });
      // Calculate max length without ANSI codes for proper alignment
      const flagLengths = command.flags.map((flg) => {
        const short = flg.short ? `-${flg.short}, ` : '    ';
        const value = flg.takesValue ? ' <value>' : '';
        return `${short}--${flg.long}${value}`.length;
      });
      const maxFlagLen = Math.max(...flagLengths);

      for (let i = 0; i < command.flags.length; i++) {
        const flg = command.flags[i];
        const flagStr = flagStrings[i];
        const padding = ' '.repeat(maxFlagLen - flagLengths[i] + 2);
        const defaultVal = flg.default !== undefined
          ? colors.muted(` [default: ${flg.default}]`)
          : '';
        console.log(`  ${flagStr}${padding}${flg.description ?? ''}${defaultVal}`);
      }
    }

    if (command.aliases && command.aliases.length > 0) {
      console.log(`\n${colors.header('ALIASES:')}`);
      console.log(`  ${colors.muted(command.aliases.join(', '))}`);
    }
  }
}

/**
 * Create a new CLI instance
 *
 * @param config - CLI configuration
 * @returns A new CLI instance
 *
 * @example
 * ```ts
 * const cli = createCli({
 *   name: "my-tool",
 *   version: "1.0.0",
 *   description: "My awesome CLI tool",
 * });
 * ```
 */
export function createCli(config: CliConfig): Cli {
  return new Cli(config);
}
