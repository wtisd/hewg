/**
 * hewg - A versatile CLI framework for Deno
 *
 * @module
 * @example
 * ```ts
 * import { createCli, Command } from "@erdtree/hewg";
 *
 * const cli = createCli({
 *   name: "my-tool",
 *   version: "1.0.0",
 *   description: "My awesome CLI tool",
 * });
 *
 * cli.register({
 *   name: "hello",
 *   description: "Say hello",
 *   action: () => console.log("Hello!"),
 * });
 *
 * await cli.run(Deno.args);
 * ```
 */

export { Cli, createCli } from './cli/mod.ts';
export type { CliConfig, Command, CommandContext, CommandOptions } from './cli/types.ts';
export { VERSION } from './version.ts';
export * as colors from './cli/colors.ts';
