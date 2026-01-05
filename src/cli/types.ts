/**
 * CLI type definitions
 */

/**
 * Configuration for creating a CLI instance
 */
export interface CliConfig {
  /** Name of the CLI tool */
  name: string;
  /** Version string */
  version: string;
  /** Description of the CLI tool */
  description?: string;
  /** Custom usage string */
  usage?: string;
}

/**
 * Options for a command argument
 */
export interface ArgOption {
  /** Name of the argument */
  name: string;
  /** Short description */
  description?: string;
  /** Whether the argument is required */
  required?: boolean;
  /** Default value if not provided */
  default?: string;
}

/**
 * Options for a command flag
 */
export interface FlagOption {
  /** Short flag (single character, e.g., 'v' for -v) */
  short?: string;
  /** Long flag name (e.g., 'verbose' for --verbose) */
  long: string;
  /** Description of the flag */
  description?: string;
  /** Whether the flag takes a value */
  takesValue?: boolean;
  /** Default value */
  default?: string | boolean;
  /** Whether the flag is required */
  required?: boolean;
}

/**
 * Options for defining a command
 */
export interface CommandOptions {
  /** Command name */
  name: string;
  /** Command description */
  description?: string;
  /** Command aliases */
  aliases?: string[];
  /** Positional arguments */
  args?: ArgOption[];
  /** Command flags */
  flags?: FlagOption[];
  /** Subcommands */
  subcommands?: Command[];
  /** Whether this is a hidden command */
  hidden?: boolean;
}

/**
 * Context passed to command action handlers
 */
export interface CommandContext {
  /** Parsed positional arguments */
  args: Record<string, string | undefined>;
  /** Parsed flags */
  flags: Record<string, string | boolean | undefined>;
  /** Raw arguments array */
  rawArgs: string[];
  /** CLI configuration */
  config: CliConfig;
}

/**
 * Command action handler type
 */
export type CommandAction = (context: CommandContext) => void | Promise<void>;

/**
 * Complete command definition
 */
export interface Command extends CommandOptions {
  /** Action to execute when command is invoked */
  action?: CommandAction;
}

/**
 * Result of parsing command line arguments
 */
export interface ParseResult {
  /** The matched command */
  command: Command | null;
  /** Parsed arguments */
  args: Record<string, string | undefined>;
  /** Parsed flags */
  flags: Record<string, string | boolean | undefined>;
  /** Remaining unparsed arguments */
  remaining: string[];
  /** Any parsing errors */
  errors: string[];
}
