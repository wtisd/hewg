/**
 * Module exports tests
 */

import { assertExists } from '@std/assert';
import { describe, it } from '@std/testing/bdd';
import { createCli, VERSION } from '../src/mod.ts';

describe('Module Exports', () => {
  describe('createCli', () => {
    it('should be exported from mod.ts', () => {
      assertExists(createCli);
    });

    it('should be a function', () => {
      assertExists(typeof createCli === 'function');
    });
  });

  describe('VERSION', () => {
    it('should be exported from mod.ts', () => {
      assertExists(VERSION);
    });

    it('should be a string', () => {
      assertExists(typeof VERSION === 'string');
    });
  });
});
