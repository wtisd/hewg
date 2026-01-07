/**
 * CLI framework tests
 */

import { assertEquals, assertExists } from '@std/assert';
import { describe, it } from '@std/testing/bdd';
import { createCli } from '../../src/cli/mod.ts';
import type { Command } from '../../src/cli/types.ts';

describe('Cli', () => {
  describe('createCli', () => {
    it('should create a CLI instance with config', () => {
      const cli = createCli({
        name: 'test-cli',
        version: '1.0.0',
        description: 'Test CLI',
      });

      assertExists(cli);
    });
  });

  describe('register', () => {
    it('should register a command', () => {
      const cli = createCli({
        name: 'test-cli',
        version: '1.0.0',
      });

      const command: Command = {
        name: 'test',
        description: 'Test command',
        action: () => {},
      };

      cli.register(command);

      const registered = cli.getCommand('test');
      assertEquals(registered?.name, 'test');
    });

    it('should register command aliases', () => {
      const cli = createCli({
        name: 'test-cli',
        version: '1.0.0',
      });

      const command: Command = {
        name: 'test',
        description: 'Test command',
        aliases: ['t', 'tst'],
        action: () => {},
      };

      cli.register(command);

      assertEquals(cli.getCommand('t')?.name, 'test');
      assertEquals(cli.getCommand('tst')?.name, 'test');
    });
  });

  describe('parse', () => {
    it('should parse command with no arguments', () => {
      const cli = createCli({
        name: 'test-cli',
        version: '1.0.0',
      });

      cli.register({
        name: 'hello',
        action: () => {},
      });

      const result = cli.parse(['hello']);
      assertEquals(result.command?.name, 'hello');
      assertEquals(result.errors.length, 0);
    });

    it('should parse command with positional arguments', () => {
      const cli = createCli({
        name: 'test-cli',
        version: '1.0.0',
      });

      cli.register({
        name: 'greet',
        args: [
          { name: 'name', required: true },
          { name: 'title', required: false },
        ],
        action: () => {},
      });

      const result = cli.parse(['greet', 'Alice', 'Dr.']);
      assertEquals(result.command?.name, 'greet');
      assertEquals(result.args.name, 'Alice');
      assertEquals(result.args.title, 'Dr.');
    });

    it('should report error for missing required argument', () => {
      const cli = createCli({
        name: 'test-cli',
        version: '1.0.0',
      });

      cli.register({
        name: 'greet',
        args: [{ name: 'name', required: true }],
        action: () => {},
      });

      const result = cli.parse(['greet']);
      assertEquals(result.errors.length, 1);
      assertEquals(result.errors[0], 'Missing required argument: name');
    });

    it('should parse boolean flags', () => {
      const cli = createCli({
        name: 'test-cli',
        version: '1.0.0',
      });

      cli.register({
        name: 'test',
        flags: [
          { long: 'verbose', short: 'v', takesValue: false },
        ],
        action: () => {},
      });

      const result = cli.parse(['test', '--verbose']);
      assertEquals(result.flags.verbose, true);
    });

    it('should parse flags with values', () => {
      const cli = createCli({
        name: 'test-cli',
        version: '1.0.0',
      });

      cli.register({
        name: 'test',
        flags: [
          { long: 'output', short: 'o', takesValue: true },
        ],
        action: () => {},
      });

      const result = cli.parse(['test', '--output', 'file.txt']);
      assertEquals(result.flags.output, 'file.txt');
    });

    it('should use default values for flags', () => {
      const cli = createCli({
        name: 'test-cli',
        version: '1.0.0',
      });

      cli.register({
        name: 'test',
        flags: [
          { long: 'count', takesValue: true, default: '10' },
        ],
        action: () => {},
      });

      const result = cli.parse(['test']);
      assertEquals(result.flags.count, '10');
    });

    it('should parse global --help flag', () => {
      const cli = createCli({
        name: 'test-cli',
        version: '1.0.0',
      });

      const result = cli.parse(['--help']);
      assertEquals(result.flags.help, true);
      assertEquals(result.command, null);
    });

    it('should parse global --version flag', () => {
      const cli = createCli({
        name: 'test-cli',
        version: '1.0.0',
      });

      const result = cli.parse(['--version']);
      assertEquals(result.flags.version, true);
      assertEquals(result.command, null);
    });
  });

  describe('getCommands', () => {
    it('should return all registered commands', () => {
      const cli = createCli({
        name: 'test-cli',
        version: '1.0.0',
      });

      cli.register({ name: 'cmd1', action: () => {} });
      cli.register({ name: 'cmd2', action: () => {} });
      cli.register({ name: 'cmd3', action: () => {} });

      const commands = cli.getCommands();
      assertEquals(commands.length, 3);
    });
  });
});
