/**
 * Tests for color utilities
 */

import { assertEquals, assertStringIncludes } from '@std/assert';
import * as colors from '../src/cli/colors.ts';

// ANSI color codes for verification
const ANSI = {
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  CYAN: '\x1b[36m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  RESET: '\x1b[39m',
};

Deno.test('colors.success returns green text', () => {
  const result = colors.success('OK');
  assertStringIncludes(result, 'OK');
  assertStringIncludes(result, ANSI.GREEN);
});

Deno.test('colors.error returns bold red text', () => {
  const result = colors.error('Error');
  assertStringIncludes(result, 'Error');
  assertStringIncludes(result, ANSI.RED);
  assertStringIncludes(result, ANSI.BOLD);
});

Deno.test('colors.warn returns yellow text', () => {
  const result = colors.warn('Warning');
  assertStringIncludes(result, 'Warning');
  assertStringIncludes(result, ANSI.YELLOW);
});

Deno.test('colors.info returns cyan text', () => {
  const result = colors.info('Info');
  assertStringIncludes(result, 'Info');
  assertStringIncludes(result, ANSI.CYAN);
});

Deno.test('colors.highlight returns bold cyan text', () => {
  const result = colors.highlight('Important');
  assertStringIncludes(result, 'Important');
  assertStringIncludes(result, ANSI.CYAN);
  assertStringIncludes(result, ANSI.BOLD);
});

Deno.test('colors.muted returns dim text', () => {
  const result = colors.muted('Secondary');
  assertStringIncludes(result, 'Secondary');
  assertStringIncludes(result, ANSI.DIM);
});

Deno.test('colors.command returns cyan text', () => {
  const result = colors.command('help');
  assertStringIncludes(result, 'help');
  assertStringIncludes(result, ANSI.CYAN);
});

Deno.test('colors.flag returns yellow text', () => {
  const result = colors.flag('--verbose');
  assertStringIncludes(result, '--verbose');
  assertStringIncludes(result, ANSI.YELLOW);
});

Deno.test('colors.argument returns dim text', () => {
  const result = colors.argument('<file>');
  assertStringIncludes(result, '<file>');
  assertStringIncludes(result, ANSI.DIM);
});

Deno.test('colors.header returns bold text', () => {
  const result = colors.header('USAGE:');
  assertStringIncludes(result, 'USAGE:');
  assertStringIncludes(result, ANSI.BOLD);
});

// Test that functions return strings containing the original text
Deno.test('all color functions preserve original text', () => {
  const text = 'test message';

  assertEquals(colors.success(text).includes(text), true);
  assertEquals(colors.error(text).includes(text), true);
  assertEquals(colors.warn(text).includes(text), true);
  assertEquals(colors.info(text).includes(text), true);
  assertEquals(colors.highlight(text).includes(text), true);
  assertEquals(colors.muted(text).includes(text), true);
  assertEquals(colors.command(text).includes(text), true);
  assertEquals(colors.flag(text).includes(text), true);
  assertEquals(colors.argument(text).includes(text), true);
  assertEquals(colors.header(text).includes(text), true);
});

// Test with empty strings
Deno.test('color functions handle empty strings', () => {
  assertEquals(typeof colors.success(''), 'string');
  assertEquals(typeof colors.error(''), 'string');
  assertEquals(typeof colors.warn(''), 'string');
  assertEquals(typeof colors.info(''), 'string');
  assertEquals(typeof colors.highlight(''), 'string');
  assertEquals(typeof colors.muted(''), 'string');
  assertEquals(typeof colors.command(''), 'string');
  assertEquals(typeof colors.flag(''), 'string');
  assertEquals(typeof colors.argument(''), 'string');
  assertEquals(typeof colors.header(''), 'string');
});

// Test with special characters
Deno.test('color functions handle special characters', () => {
  const special = '日本語 emoji 🎉 <script>';

  assertStringIncludes(colors.success(special), special);
  assertStringIncludes(colors.error(special), special);
  assertStringIncludes(colors.info(special), special);
});
