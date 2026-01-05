/**
 * Version command - Display version information
 */

import type { Command } from '../types.ts';
import { VERSION } from '../../version.ts';

/**
 * Version command definition
 *
 * Shows detailed version information.
 */
export const versionCommand: Command = {
  name: 'version',
  description: 'Display version information',
  aliases: ['v'],
  flags: [
    {
      short: 'j',
      long: 'json',
      description: 'Output as JSON',
      takesValue: false,
      default: false,
    },
  ],
  action: (ctx) => {
    const asJson = ctx.flags.json as boolean;

    const versionInfo = {
      name: ctx.config.name,
      version: VERSION,
      deno: Deno.version.deno,
      typescript: Deno.version.typescript,
      v8: Deno.version.v8,
    };

    if (asJson) {
      console.log(JSON.stringify(versionInfo, null, 2));
    } else {
      console.log(`${versionInfo.name} ${versionInfo.version}`);
      console.log(`Deno ${versionInfo.deno}`);
      console.log(`TypeScript ${versionInfo.typescript}`);
      console.log(`V8 ${versionInfo.v8}`);
    }
  },
};
