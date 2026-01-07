/**
 * Tests for pr-status command
 */

import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';
import { _internals } from '../src/cli/commands/pr-status.ts';

const { extractFromBranch, extractFromBody } = _internals;

describe('extractFromBranch', () => {
  const defaultPattern = '^[^/]+/[^/]+/(\\d+)/.*$';

  it('should extract issue number from standard branch name', () => {
    const result = extractFromBranch('feature/alice/123/add-auth', defaultPattern);
    assertEquals(result, [123]);
  });

  it('should extract issue number from branch with # prefix', () => {
    const result = extractFromBranch('feature/alice/#123/add-auth', '^[^/]+/[^/]+/#(\\d+)/.*$');
    assertEquals(result, [123]);
  });

  it('should return empty array for non-matching branch', () => {
    const result = extractFromBranch('main', defaultPattern);
    assertEquals(result, []);
  });

  it('should return empty array for develop branch', () => {
    const result = extractFromBranch('develop', defaultPattern);
    assertEquals(result, []);
  });

  it('should handle invalid regex pattern', () => {
    const result = extractFromBranch('feature/alice/123/add-auth', '[invalid');
    assertEquals(result, []);
  });

  it('should extract from bugfix branch', () => {
    const result = extractFromBranch('bugfix/bob/456/fix-memory-leak', defaultPattern);
    assertEquals(result, [456]);
  });
});

describe('extractFromBody', () => {
  it('should extract issue number from Closes keyword', () => {
    const result = extractFromBody('Closes #123');
    assertEquals(result, [123]);
  });

  it('should extract issue number from Fixes keyword', () => {
    const result = extractFromBody('Fixes #456');
    assertEquals(result, [456]);
  });

  it('should extract issue number from Resolves keyword', () => {
    const result = extractFromBody('Resolves #789');
    assertEquals(result, [789]);
  });

  it('should extract multiple issue numbers', () => {
    const result = extractFromBody('Fixes #123, Closes #456');
    assertEquals(result, [123, 456]);
  });

  it('should deduplicate issue numbers', () => {
    const result = extractFromBody('Fixes #123, Also fixes #123');
    assertEquals(result, [123]);
  });

  it('should handle case-insensitive keywords', () => {
    const result = extractFromBody('CLOSES #123, fixes #456, ReSOLVES #789');
    assertEquals(result, [123, 456, 789]);
  });

  it('should return empty array for empty body', () => {
    const result = extractFromBody('');
    assertEquals(result, []);
  });

  it('should return empty array for body without keywords', () => {
    const result = extractFromBody('This is a description without issue references');
    assertEquals(result, []);
  });

  it('should handle past tense keywords', () => {
    const result = extractFromBody('Closed #123, Fixed #456, Resolved #789');
    assertEquals(result, [123, 456, 789]);
  });
});
