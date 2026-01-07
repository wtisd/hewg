/**
 * Tests for link-issue command
 */

import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';
import { _internals } from '../src/cli/commands/link-issue.ts';

const { parseToml } = _internals;

describe('parseToml', () => {
  it('should parse project section with URL', () => {
    const content = `
[project]
url = "https://github.com/users/testuser/projects/1"
    `;
    const result = parseToml(content);
    assertEquals(result.project.url, 'https://github.com/users/testuser/projects/1');
  });

  it('should parse defaults section', () => {
    const content = `
[project]
url = "https://github.com/users/testuser/projects/1"

[defaults]
status = "Todo"
priority = "P1"
size = 3
    `;
    const result = parseToml(content);
    assertEquals(result.defaults.status, 'Todo');
    assertEquals(result.defaults.priority, 'P1');
    assertEquals(result.defaults.size, 3);
  });

  it('should parse date values', () => {
    const content = `
[defaults]
start_date = "2026-01-01"
target_date = "2026-01-15"
    `;
    const result = parseToml(content);
    assertEquals(result.defaults.start_date, '2026-01-01');
    assertEquals(result.defaults.target_date, '2026-01-15');
  });

  it('should skip comments', () => {
    const content = `
# This is a comment
[project]
# Another comment
url = "https://github.com/users/testuser/projects/1"
    `;
    const result = parseToml(content);
    assertEquals(result.project.url, 'https://github.com/users/testuser/projects/1');
  });
});
