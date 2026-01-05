/**
 * Color utilities for CLI output
 *
 * Provides semantic color functions for consistent terminal styling.
 * Uses Deno's standard library for cross-platform color support.
 *
 * @module
 *
 * @example
 * ```ts
 * import * as colors from '@erdtree/hewg/cli/colors';
 *
 * console.log(colors.success('Operation completed!'));
 * console.log(colors.error('Something went wrong'));
 * console.log(colors.warn('Deprecated feature'));
 * ```
 */

import { bold, cyan, dim, green, red, yellow } from '@std/fmt/colors';

/**
 * Format success messages in green.
 *
 * @param text - The text to format
 * @returns Green formatted text
 *
 * @example
 * ```ts
 * console.log(colors.success('Done!')); // Outputs green "Done!"
 * ```
 */
export function success(text: string): string {
  return green(text);
}

/**
 * Format error messages in bold red.
 *
 * @param text - The text to format
 * @returns Bold red formatted text
 *
 * @example
 * ```ts
 * console.log(colors.error('Failed!')); // Outputs bold red "Failed!"
 * ```
 */
export function error(text: string): string {
  return bold(red(text));
}

/**
 * Format warning messages in yellow.
 *
 * @param text - The text to format
 * @returns Yellow formatted text
 *
 * @example
 * ```ts
 * console.log(colors.warn('Careful!')); // Outputs yellow "Careful!"
 * ```
 */
export function warn(text: string): string {
  return yellow(text);
}

/**
 * Format informational text in cyan.
 *
 * @param text - The text to format
 * @returns Cyan formatted text
 *
 * @example
 * ```ts
 * console.log(colors.info('Note:')); // Outputs cyan "Note:"
 * ```
 */
export function info(text: string): string {
  return cyan(text);
}

/**
 * Format highlighted text in bold cyan.
 *
 * @param text - The text to format
 * @returns Bold cyan formatted text
 *
 * @example
 * ```ts
 * console.log(colors.highlight('Important')); // Outputs bold cyan "Important"
 * ```
 */
export function highlight(text: string): string {
  return bold(cyan(text));
}

/**
 * Format de-emphasized text in dim style.
 *
 * @param text - The text to format
 * @returns Dim formatted text
 *
 * @example
 * ```ts
 * console.log(colors.muted('(optional)')); // Outputs dimmed "(optional)"
 * ```
 */
export function muted(text: string): string {
  return dim(text);
}

/**
 * Format command names in cyan.
 * Used for displaying command names in help output.
 *
 * @param text - The command name to format
 * @returns Cyan formatted text
 *
 * @example
 * ```ts
 * console.log(colors.command('hello')); // Outputs cyan "hello"
 * ```
 */
export function command(text: string): string {
  return cyan(text);
}

/**
 * Format flag names in yellow.
 * Used for displaying flags like --help or -v.
 *
 * @param text - The flag to format
 * @returns Yellow formatted text
 *
 * @example
 * ```ts
 * console.log(colors.flag('--verbose')); // Outputs yellow "--verbose"
 * ```
 */
export function flag(text: string): string {
  return yellow(text);
}

/**
 * Format argument placeholders in dim style.
 * Used for displaying argument placeholders like <name> or [options].
 *
 * @param text - The argument placeholder to format
 * @returns Dim formatted text
 *
 * @example
 * ```ts
 * console.log(colors.argument('<file>')); // Outputs dimmed "<file>"
 * ```
 */
export function argument(text: string): string {
  return dim(text);
}

/**
 * Format section headers in bold.
 * Used for section titles like "USAGE:" or "COMMANDS:".
 *
 * @param text - The header text to format
 * @returns Bold formatted text
 *
 * @example
 * ```ts
 * console.log(colors.header('USAGE:')); // Outputs bold "USAGE:"
 * ```
 */
export function header(text: string): string {
  return bold(text);
}
