#!/usr/bin/env -S deno run --allow-read --allow-env
/**
 * hewg CLI entry point
 *
 * This is the main executable for the hewg CLI tool.
 * It demonstrates the CLI framework capabilities.
 */

import { createCli } from './cli/mod.ts';
import { helloCommand } from './cli/commands/hello.ts';
import { versionCommand } from './cli/commands/version.ts';

const cli = createCli({
  name: 'hewg',
  version: '0.1.0',
  description: 'A versatile CLI framework for Deno',
});

// Register built-in commands
cli.register(helloCommand);
cli.register(versionCommand);

// Run the CLI
if (import.meta.main) {
  await cli.run(Deno.args);
}
