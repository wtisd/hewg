/**
 * Auto-tag command for semantic versioning
 *
 * This command calculates the next semantic version based on:
 * - Current git tags
 * - Branch label (first segment of branch name)
 * - Target branch (main or develop)
 *
 * Used by GitHub Actions to automatically create tags on PR merge.
 *
 * @module
 */

import type { Command, CommandContext } from '../types.ts';
import * as colors from '../colors.ts';

/**
 * Version components parsed from a semantic version tag
 */
interface VersionComponents {
  major: number;
  minor: number;
  patch: number;
  rc: number | null;
}

/**
 * Tag configuration from project.toml
 */
interface TagConfig {
  major_labels: string[];
  minor_labels: string[];
  patch_labels: string[];
}

/**
 * Result of the auto-tag calculation
 */
interface AutoTagResult {
  success: boolean;
  currentTag: string | null;
  newTag: string | null;
  label: string;
  incrementType: 'MAJOR' | 'MINOR' | 'PATCH' | 'RC_ONLY';
  targetBranch: string;
  isDevelopToMain: boolean;
  error?: string;
}

/**
 * Parse a TOML file content (simple parser for our use case)
 *
 * @param content - TOML file content
 * @returns Parsed configuration object
 */
function parseToml(content: string): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  let currentSection: string | null = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Section header
    const sectionMatch = trimmed.match(/^\[(\w+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      if (!result[currentSection]) result[currentSection] = {};
      continue;
    }

    // Key-value pair
    const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (kvMatch && currentSection) {
      let value: unknown = kvMatch[2].trim();

      // Remove quotes from strings
      if (
        (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) ||
        (typeof value === 'string' && value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      } // Parse arrays
      else if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
        try {
          value = JSON.parse(value.replace(/'/g, '"'));
        } catch {
          // If JSON parse fails, try manual parsing
          value = value
            .slice(1, -1)
            .split(',')
            .map((s: string) => s.trim().replace(/^["']|["']$/g, ''))
            .filter((s: string) => s);
        }
      } // Parse booleans
      else if (value === 'true') {
        value = true;
      } else if (value === 'false') {
        value = false;
      } // Parse numbers
      else if (typeof value === 'string' && /^\d+$/.test(value)) {
        value = parseInt(value, 10);
      } else if (typeof value === 'string' && /^\d+\.\d+$/.test(value)) {
        value = parseFloat(value);
      }

      result[currentSection][kvMatch[1]] = value;
    }
  }

  return result;
}

/**
 * Parse a version tag into components
 *
 * @param tag - Version tag (e.g., "v1.2.3-rc.4" or "v1.2.3")
 * @returns Parsed version components
 *
 * @example
 * ```ts
 * parseVersion("v1.2.3-rc.4")
 * // { major: 1, minor: 2, patch: 3, rc: 4 }
 *
 * parseVersion("v1.2.3")
 * // { major: 1, minor: 2, patch: 3, rc: null }
 * ```
 */
function parseVersion(tag: string | null): VersionComponents {
  if (!tag) {
    return { major: 0, minor: 0, patch: 0, rc: null };
  }

  // Remove 'v' prefix if present
  const version = tag.startsWith('v') ? tag.slice(1) : tag;

  // Match version pattern: MAJOR.MINOR.PATCH[-rc.N]
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/);
  if (!match) {
    return { major: 0, minor: 0, patch: 0, rc: null };
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    rc: match[4] !== undefined ? parseInt(match[4], 10) : null,
  };
}

/**
 * Get the increment type based on branch label and configuration
 *
 * @param label - Branch label (first segment of branch name)
 * @param config - Tag configuration
 * @returns Increment type
 */
function getIncrementType(
  label: string,
  config: TagConfig,
): 'MAJOR' | 'MINOR' | 'PATCH' | 'RC_ONLY' {
  if (config.major_labels.includes(label)) return 'MAJOR';
  if (config.minor_labels.includes(label)) return 'MINOR';
  if (config.patch_labels.includes(label)) return 'PATCH';
  return 'RC_ONLY';
}

/**
 * Extract label from branch name (first segment)
 *
 * @param branchName - Full branch name
 * @returns First segment (label)
 *
 * @example
 * ```ts
 * extractLabel("feature/wtisd/8/auto-tag")
 * // "feature"
 * ```
 */
function extractLabel(branchName: string): string {
  const segments = branchName.split('/');
  return segments[0] || '';
}

/**
 * Calculate new version based on current version, increment type, and target branch
 *
 * @param current - Current version components
 * @param incrementType - Type of increment (MAJOR, MINOR, PATCH, RC_ONLY)
 * @param targetBranch - Target branch (main or develop)
 * @param isDevelopToMain - Whether this is a develop->main merge
 * @returns New version tag string
 */
function calculateNewVersion(
  current: VersionComponents,
  incrementType: 'MAJOR' | 'MINOR' | 'PATCH' | 'RC_ONLY',
  targetBranch: string,
  isDevelopToMain: boolean,
): string {
  // Special case: develop -> main merge
  if (isDevelopToMain) {
    // Strip RC suffix, keep version numbers
    return `v${current.major}.${current.minor}.${current.patch}`;
  }

  const isRC = targetBranch === 'develop';

  if (isRC) {
    // RC version for develop branch
    if (incrementType === 'MAJOR') {
      return `v${current.major + 1}.0.0-rc.0`;
    } else if (incrementType === 'MINOR') {
      return `v${current.major}.${current.minor + 1}.0-rc.0`;
    } else if (incrementType === 'PATCH') {
      return `v${current.major}.${current.minor}.${current.patch + 1}-rc.0`;
    } else {
      // RC_ONLY - just increment RC counter
      const rcNum = (current.rc ?? -1) + 1;
      return `v${current.major}.${current.minor}.${current.patch}-rc.${rcNum}`;
    }
  } else {
    // Release version for main branch
    if (incrementType === 'MAJOR') {
      return `v${current.major + 1}.0.0`;
    } else if (incrementType === 'MINOR') {
      return `v${current.major}.${current.minor + 1}.0`;
    } else {
      // PATCH or RC_ONLY defaults to PATCH for main
      return `v${current.major}.${current.minor}.${current.patch + 1}`;
    }
  }
}

/**
 * Get the latest git tag
 *
 * @returns Latest tag or null if none exists
 */
async function getLatestTag(): Promise<string | null> {
  try {
    const command = new Deno.Command('git', {
      args: ['describe', '--tags', '--abbrev=0'],
      stdout: 'piped',
      stderr: 'piped',
    });

    const { code, stdout } = await command.output();
    if (code !== 0) {
      return null;
    }

    const tag = new TextDecoder().decode(stdout).trim();
    return tag || null;
  } catch {
    return null;
  }
}

/**
 * Load tag configuration from project.toml
 *
 * @param configPath - Path to project.toml
 * @returns Tag configuration with defaults
 */
async function loadConfig(configPath: string): Promise<TagConfig> {
  const defaults: TagConfig = {
    major_labels: ['release'],
    minor_labels: ['feature'],
    patch_labels: ['bugfix', 'fix', 'patch', 'hotfix'],
  };

  try {
    const content = await Deno.readTextFile(configPath);
    const config = parseToml(content);

    if (config.tag) {
      return {
        major_labels: (config.tag.major_labels as string[]) || defaults.major_labels,
        minor_labels: (config.tag.minor_labels as string[]) || defaults.minor_labels,
        patch_labels: (config.tag.patch_labels as string[]) || defaults.patch_labels,
      };
    }
  } catch {
    // Config file not found or invalid, use defaults
  }

  return defaults;
}

/**
 * Action handler for the auto-tag command
 */
async function autoTagAction(ctx: CommandContext): Promise<void> {
  const sourceBranch = ctx.flags['source-branch'] as string | undefined;
  const targetBranch = ctx.flags['target-branch'] as string | undefined;
  const configPath = (ctx.flags['config'] as string) || '.github/project.toml';
  const jsonOutput = ctx.flags['json'] as boolean | undefined;
  const dryRun = ctx.flags['dry-run'] as boolean | undefined;

  // Validate required flags
  if (!sourceBranch) {
    const error = 'Error: --source-branch is required';
    if (jsonOutput) {
      console.log(JSON.stringify({ success: false, error }));
    } else {
      console.error(colors.error(error));
    }
    Deno.exit(1);
  }

  if (!targetBranch) {
    const error = 'Error: --target-branch is required';
    if (jsonOutput) {
      console.log(JSON.stringify({ success: false, error }));
    } else {
      console.error(colors.error(error));
    }
    Deno.exit(1);
  }

  try {
    // Load configuration
    const config = await loadConfig(configPath);

    // Get latest tag
    const latestTag = await getLatestTag();

    // Parse current version
    const currentVersion = parseVersion(latestTag);

    // Check if this is a develop -> main merge
    const isDevelopToMain = targetBranch === 'main' && sourceBranch === 'develop';

    // Extract label from source branch
    const label = extractLabel(sourceBranch);

    // Get increment type
    const incrementType = getIncrementType(label, config);

    // Calculate new version
    const newTag = calculateNewVersion(currentVersion, incrementType, targetBranch, isDevelopToMain);

    const result: AutoTagResult = {
      success: true,
      currentTag: latestTag,
      newTag,
      label,
      incrementType,
      targetBranch,
      isDevelopToMain,
    };

    if (jsonOutput) {
      console.log(JSON.stringify(result));
    } else {
      console.log(colors.highlight('\n🏷️  Auto Tag Calculator\n'));
      console.log(`${colors.muted('Current tag:')} ${latestTag || '(none, starting from v0.0.0)'}`);
      console.log(`${colors.muted('Source branch:')} ${sourceBranch}`);
      console.log(`${colors.muted('Target branch:')} ${targetBranch}`);
      console.log(`${colors.muted('Label:')} ${label}`);
      console.log(`${colors.muted('Increment type:')} ${incrementType}`);
      console.log(`${colors.muted('Is develop→main:')} ${isDevelopToMain}`);
      console.log();
      console.log(colors.success(`✓ New tag: ${newTag}`));

      if (!dryRun) {
        console.log(colors.muted('\nUse --dry-run to skip tag creation'));
      }
    }

    // Create tag if not dry run
    if (!dryRun) {
      const tagMessage = `Release ${newTag}`;
      const createCommand = new Deno.Command('git', {
        args: ['tag', '-a', newTag, '-m', tagMessage],
        stdout: 'piped',
        stderr: 'piped',
      });

      const { code: createCode, stderr: createStderr } = await createCommand.output();
      if (createCode !== 0) {
        const errorMsg = new TextDecoder().decode(createStderr);
        throw new Error(`Failed to create tag: ${errorMsg}`);
      }

      // Push tag
      const pushCommand = new Deno.Command('git', {
        args: ['push', 'origin', newTag],
        stdout: 'piped',
        stderr: 'piped',
      });

      const { code: pushCode, stderr: pushStderr } = await pushCommand.output();
      if (pushCode !== 0) {
        const errorMsg = new TextDecoder().decode(pushStderr);
        throw new Error(`Failed to push tag: ${errorMsg}`);
      }

      if (!jsonOutput) {
        console.log(colors.success(`✓ Tag ${newTag} created and pushed`));
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (jsonOutput) {
      console.log(JSON.stringify({ success: false, error: errorMessage }));
    } else {
      console.error(colors.error(`\n❌ Error: ${errorMessage}\n`));
    }
    Deno.exit(1);
  }
}

/**
 * Auto-tag command definition
 *
 * Calculates and creates semantic version tags based on branch labels.
 *
 * @example
 * ```bash
 * # Calculate next version (dry run)
 * hewg auto-tag --source-branch feature/wtisd/8/my-feature --target-branch develop --dry-run
 *
 * # Create and push tag
 * hewg auto-tag --source-branch feature/wtisd/8/my-feature --target-branch develop
 *
 * # JSON output for GitHub Actions
 * hewg auto-tag --source-branch feature/wtisd/8/my-feature --target-branch develop --json
 * ```
 */
export const autoTagCommand: Command = {
  name: 'auto-tag',
  description: 'Calculate and create semantic version tags based on branch labels',
  flags: [
    {
      short: 's',
      long: 'source-branch',
      description: 'Source branch name (PR head branch)',
      takesValue: true,
      required: true,
    },
    {
      short: 't',
      long: 'target-branch',
      description: 'Target branch name (PR base branch)',
      takesValue: true,
      required: true,
    },
    {
      short: 'c',
      long: 'config',
      description: 'Path to project.toml config file',
      takesValue: true,
      default: '.github/project.toml',
    },
    {
      long: 'json',
      description: 'Output result as JSON',
    },
    {
      short: 'n',
      long: 'dry-run',
      description: 'Calculate version without creating tag',
    },
  ],
  action: autoTagAction,
};
