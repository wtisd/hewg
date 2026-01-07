/**
 * Tests for auto-tag command functions
 */

import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';
import { _internals } from '../../src/cli/commands/auto-tag.ts';

const { parseVersion, extractLabel, getIncrementType, calculateNewVersion, parseToml } = _internals;

describe('parseVersion', () => {
  it('should parse a simple version tag', () => {
    const result = parseVersion('v1.2.3');
    assertEquals(result, { major: 1, minor: 2, patch: 3, rc: null });
  });

  it('should parse a version tag with RC suffix', () => {
    const result = parseVersion('v1.2.3-rc.4');
    assertEquals(result, { major: 1, minor: 2, patch: 3, rc: 4 });
  });

  it('should handle version without v prefix', () => {
    const result = parseVersion('1.2.3');
    assertEquals(result, { major: 1, minor: 2, patch: 3, rc: null });
  });

  it('should return zeros for null input', () => {
    const result = parseVersion(null);
    assertEquals(result, { major: 0, minor: 0, patch: 0, rc: null });
  });

  it('should return zeros for invalid version format', () => {
    const result = parseVersion('invalid');
    assertEquals(result, { major: 0, minor: 0, patch: 0, rc: null });
  });

  it('should handle v0.0.0', () => {
    const result = parseVersion('v0.0.0');
    assertEquals(result, { major: 0, minor: 0, patch: 0, rc: null });
  });

  it('should handle RC version 0', () => {
    const result = parseVersion('v1.0.0-rc.0');
    assertEquals(result, { major: 1, minor: 0, patch: 0, rc: 0 });
  });
});

describe('extractLabel', () => {
  it('should extract label from standard branch name', () => {
    const result = extractLabel('feature/wtisd/8/auto-tag');
    assertEquals(result, 'feature');
  });

  it('should extract label from branch with # in name', () => {
    const result = extractLabel('feature/wtisd/#8/auto-tag-workflow');
    assertEquals(result, 'feature');
  });

  it('should extract label from bugfix branch', () => {
    const result = extractLabel('bugfix/wtisd/10/fix-something');
    assertEquals(result, 'bugfix');
  });

  it('should handle branch name without slashes', () => {
    const result = extractLabel('main');
    assertEquals(result, 'main');
  });

  it('should handle empty string', () => {
    const result = extractLabel('');
    assertEquals(result, '');
  });

  it('should handle develop branch', () => {
    const result = extractLabel('develop');
    assertEquals(result, 'develop');
  });
});

describe('getIncrementType', () => {
  const config = {
    majorLabels: ['release'],
    minorLabels: ['feature'],
    patchLabels: ['bugfix', 'fix', 'patch', 'hotfix'],
  };

  it('should return MAJOR for release label', () => {
    const result = getIncrementType('release', config);
    assertEquals(result, 'MAJOR');
  });

  it('should return MINOR for feature label', () => {
    const result = getIncrementType('feature', config);
    assertEquals(result, 'MINOR');
  });

  it('should return PATCH for bugfix label', () => {
    const result = getIncrementType('bugfix', config);
    assertEquals(result, 'PATCH');
  });

  it('should return PATCH for fix label', () => {
    const result = getIncrementType('fix', config);
    assertEquals(result, 'PATCH');
  });

  it('should return PATCH for hotfix label', () => {
    const result = getIncrementType('hotfix', config);
    assertEquals(result, 'PATCH');
  });

  it('should return RC_ONLY for unknown label', () => {
    const result = getIncrementType('refactor', config);
    assertEquals(result, 'RC_ONLY');
  });

  it('should return RC_ONLY for docs label', () => {
    const result = getIncrementType('docs', config);
    assertEquals(result, 'RC_ONLY');
  });
});

describe('calculateNewVersion', () => {
  describe('for develop branch (RC versions)', () => {
    it('should create MINOR RC version for feature', () => {
      const current = { major: 1, minor: 2, patch: 3, rc: null };
      const result = calculateNewVersion(current, 'MINOR', 'develop', false);
      assertEquals(result, 'v1.3.0-rc.0');
    });

    it('should create MAJOR RC version for release', () => {
      const current = { major: 1, minor: 2, patch: 3, rc: null };
      const result = calculateNewVersion(current, 'MAJOR', 'develop', false);
      assertEquals(result, 'v2.0.0-rc.0');
    });

    it('should create PATCH RC version for bugfix', () => {
      const current = { major: 1, minor: 2, patch: 3, rc: null };
      const result = calculateNewVersion(current, 'PATCH', 'develop', false);
      assertEquals(result, 'v1.2.4-rc.0');
    });

    it('should increment RC counter for RC_ONLY', () => {
      const current = { major: 1, minor: 2, patch: 3, rc: 0 };
      const result = calculateNewVersion(current, 'RC_ONLY', 'develop', false);
      assertEquals(result, 'v1.2.3-rc.1');
    });

    it('should start RC from 0 when no previous RC', () => {
      const current = { major: 1, minor: 2, patch: 3, rc: null };
      const result = calculateNewVersion(current, 'RC_ONLY', 'develop', false);
      assertEquals(result, 'v1.2.3-rc.0');
    });

    it('should handle first version (v0.0.0)', () => {
      const current = { major: 0, minor: 0, patch: 0, rc: null };
      const result = calculateNewVersion(current, 'MINOR', 'develop', false);
      assertEquals(result, 'v0.1.0-rc.0');
    });
  });

  describe('for main branch (release versions)', () => {
    it('should create MINOR release version', () => {
      const current = { major: 1, minor: 2, patch: 3, rc: null };
      const result = calculateNewVersion(current, 'MINOR', 'main', false);
      assertEquals(result, 'v1.3.0');
    });

    it('should create MAJOR release version', () => {
      const current = { major: 1, minor: 2, patch: 3, rc: null };
      const result = calculateNewVersion(current, 'MAJOR', 'main', false);
      assertEquals(result, 'v2.0.0');
    });

    it('should create PATCH release version', () => {
      const current = { major: 1, minor: 2, patch: 3, rc: null };
      const result = calculateNewVersion(current, 'PATCH', 'main', false);
      assertEquals(result, 'v1.2.4');
    });

    it('should default to PATCH for RC_ONLY on main', () => {
      const current = { major: 1, minor: 2, patch: 3, rc: null };
      const result = calculateNewVersion(current, 'RC_ONLY', 'main', false);
      assertEquals(result, 'v1.2.4');
    });
  });

  describe('for develop->main merge', () => {
    it('should strip RC suffix', () => {
      const current = { major: 1, minor: 2, patch: 3, rc: 5 };
      const result = calculateNewVersion(current, 'MINOR', 'main', true);
      assertEquals(result, 'v1.2.3');
    });

    it('should keep version numbers when stripping RC', () => {
      const current = { major: 2, minor: 0, patch: 0, rc: 3 };
      const result = calculateNewVersion(current, 'MAJOR', 'main', true);
      assertEquals(result, 'v2.0.0');
    });
  });
});

describe('parseToml', () => {
  it('should parse simple key-value pairs', () => {
    const content = `
[section]
key = "value"
number = 42
`;
    const result = parseToml(content);
    assertEquals(result.section.key, 'value');
    assertEquals(result.section.number, 42);
  });

  it('should parse arrays', () => {
    const content = `
[tag]
major_labels = ["release"]
minor_labels = ["feature"]
`;
    const result = parseToml(content);
    assertEquals(result.tag.major_labels, ['release']);
    assertEquals(result.tag.minor_labels, ['feature']);
  });

  it('should parse booleans', () => {
    const content = `
[settings]
enabled = true
disabled = false
`;
    const result = parseToml(content);
    assertEquals(result.settings.enabled, true);
    assertEquals(result.settings.disabled, false);
  });

  it('should skip comments', () => {
    const content = `
# This is a comment
[section]
# Another comment
key = "value"
`;
    const result = parseToml(content);
    assertEquals(result.section.key, 'value');
  });

  it('should handle multiple sections', () => {
    const content = `
[section1]
key1 = "value1"

[section2]
key2 = "value2"
`;
    const result = parseToml(content);
    assertEquals(result.section1.key1, 'value1');
    assertEquals(result.section2.key2, 'value2');
  });
});
