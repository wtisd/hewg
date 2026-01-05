/**
 * Built-in commands tests
 */

import { assertExists, assertStringIncludes } from '@std/assert';
import { describe, it } from '@std/testing/bdd';
import { helloCommand } from '../src/cli/commands/hello.ts';
import { versionCommand } from '../src/cli/commands/version.ts';

describe('Built-in Commands', () => {
  describe('helloCommand', () => {
    it('should be defined with correct properties', () => {
      assertExists(helloCommand);
      assertExists(helloCommand.name);
      assertExists(helloCommand.description);
      assertExists(helloCommand.action);
    });

    it('should have correct name', () => {
      assertStringIncludes(helloCommand.name, 'hello');
    });

    it('should have aliases', () => {
      assertExists(helloCommand.aliases);
      assertStringIncludes(helloCommand.aliases!.join(','), 'hi');
      assertStringIncludes(helloCommand.aliases!.join(','), 'greet');
    });

    it('should have name argument', () => {
      assertExists(helloCommand.args);
      const nameArg = helloCommand.args!.find((a) => a.name === 'name');
      assertExists(nameArg);
    });

    it('should have loud flag', () => {
      assertExists(helloCommand.flags);
      const loudFlag = helloCommand.flags!.find((f) => f.long === 'loud');
      assertExists(loudFlag);
    });

    it('should have count flag', () => {
      assertExists(helloCommand.flags);
      const countFlag = helloCommand.flags!.find((f) => f.long === 'count');
      assertExists(countFlag);
    });
  });

  describe('versionCommand', () => {
    it('should be defined with correct properties', () => {
      assertExists(versionCommand);
      assertExists(versionCommand.name);
      assertExists(versionCommand.description);
      assertExists(versionCommand.action);
    });

    it('should have correct name', () => {
      assertStringIncludes(versionCommand.name, 'version');
    });

    it('should have json flag', () => {
      assertExists(versionCommand.flags);
      const jsonFlag = versionCommand.flags!.find((f) => f.long === 'json');
      assertExists(jsonFlag);
    });
  });
});
