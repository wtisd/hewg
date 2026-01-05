/**
 * Tests for project configuration parsing and validation
 */

import { assertEquals, assertThrows } from '@std/assert';
import { describe, it } from '@std/testing/bdd';
import { parseProjectUrl, validateProjectConfig } from '../src/types/project-config.ts';

describe('parseProjectUrl', () => {
  it('should parse user project URLs', () => {
    const result = parseProjectUrl('https://github.com/users/myuser/projects/1');
    assertEquals(result, {
      owner: 'myuser',
      number: 1,
      isOrg: false,
    });
  });

  it('should parse user project URLs with larger numbers', () => {
    const result = parseProjectUrl('https://github.com/users/someone/projects/123');
    assertEquals(result, {
      owner: 'someone',
      number: 123,
      isOrg: false,
    });
  });

  it('should parse organization project URLs', () => {
    const result = parseProjectUrl('https://github.com/orgs/myorg/projects/5');
    assertEquals(result, {
      owner: 'myorg',
      number: 5,
      isOrg: true,
    });
  });

  it('should throw error for invalid URL format', () => {
    assertThrows(
      () => parseProjectUrl('https://github.com/myuser/myrepo'),
      Error,
      'Invalid project URL format',
    );
  });

  it('should throw error for non-github URL', () => {
    assertThrows(
      () => parseProjectUrl('https://gitlab.com/users/myuser/projects/1'),
      Error,
      'Invalid project URL format',
    );
  });
});

describe('validateProjectConfig', () => {
  it('should validate a minimal valid config', () => {
    const config = {
      project: {
        url: 'https://github.com/users/myuser/projects/1',
      },
    };
    validateProjectConfig(config);
  });

  it('should validate config with all defaults', () => {
    const config = {
      project: {
        url: 'https://github.com/users/myuser/projects/1',
      },
      defaults: {
        status: 'Planned',
        priority: 'P1',
        iteration: 'Sprint 1',
        size: 3,
        estimate: 8,
        start_date: '2026-01-05',
        target_date: '2026-01-12',
      },
    };
    validateProjectConfig(config);
  });

  it('should throw error when project section is missing', () => {
    assertThrows(
      () => validateProjectConfig({}),
      Error,
      'Configuration must have a [project] section',
    );
  });

  it('should throw error when project.url is missing', () => {
    assertThrows(
      () => validateProjectConfig({ project: {} }),
      Error,
      'project.url is required',
    );
  });

  it('should throw error for invalid status value', () => {
    const config = {
      project: { url: 'https://github.com/users/myuser/projects/1' },
      defaults: { status: 'InvalidStatus' },
    };
    assertThrows(
      () => validateProjectConfig(config),
      Error,
      'Invalid status',
    );
  });

  it('should throw error for invalid priority value', () => {
    const config = {
      project: { url: 'https://github.com/users/myuser/projects/1' },
      defaults: { priority: 'P99' },
    };
    assertThrows(
      () => validateProjectConfig(config),
      Error,
      'Invalid priority',
    );
  });

  it('should throw error for invalid size type', () => {
    const config = {
      project: { url: 'https://github.com/users/myuser/projects/1' },
      defaults: { size: 'large' },
    };
    assertThrows(
      () => validateProjectConfig(config),
      Error,
      'defaults.size must be a number',
    );
  });

  it('should throw error for invalid date format', () => {
    const config = {
      project: { url: 'https://github.com/users/myuser/projects/1' },
      defaults: { start_date: '01-05-2026' },
    };
    assertThrows(
      () => validateProjectConfig(config),
      Error,
      'defaults.start_date must be in YYYY-MM-DD format',
    );
  });

  it('should accept valid status values', () => {
    const validStatuses = ['Planned', 'Ready', 'In Progress', 'In Review', 'Done'];
    for (const status of validStatuses) {
      const config = {
        project: { url: 'https://github.com/users/myuser/projects/1' },
        defaults: { status },
      };
      validateProjectConfig(config);
    }
  });

  it('should accept valid priority values', () => {
    const validPriorities = ['P0', 'P1', 'P2'];
    for (const priority of validPriorities) {
      const config = {
        project: { url: 'https://github.com/users/myuser/projects/1' },
        defaults: { priority },
      };
      validateProjectConfig(config);
    }
  });
});
