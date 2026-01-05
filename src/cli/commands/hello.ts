/**
 * Hello command - A sample command demonstrating CLI capabilities
 */

import type { Command } from '../types.ts';

/**
 * Hello command definition
 *
 * Demonstrates positional arguments and flags.
 */
export const helloCommand: Command = {
  name: 'hello',
  description: 'Say hello to someone',
  aliases: ['hi', 'greet'],
  args: [
    {
      name: 'name',
      description: 'Name to greet',
      required: false,
      default: 'World',
    },
  ],
  flags: [
    {
      short: 'l',
      long: 'loud',
      description: 'Say it loudly (uppercase)',
      takesValue: false,
      default: false,
    },
    {
      short: 'c',
      long: 'count',
      description: 'Number of times to say hello',
      takesValue: true,
      default: '1',
    },
  ],
  action: (ctx) => {
    const name = ctx.args.name ?? 'World';
    const loud = ctx.flags.loud as boolean;
    const count = parseInt(ctx.flags.count as string, 10) || 1;

    for (let i = 0; i < count; i++) {
      let message = `Hello, ${name}!`;
      if (loud) {
        message = message.toUpperCase();
      }
      console.log(message);
    }
  },
};
