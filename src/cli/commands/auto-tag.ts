/// <reference lib="deno.ns" />
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
  majorLabels: string[];
  minorLabels: string[];
  patchLabels: string[];
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
  context?: {
    sourceBranch: string;
    configPath: string;
  };
}

/**
 * Log a debug message to stderr (to not interfere with JSON output on stdout)
 *
 * @param message - Message to log
 * @param verbose - Whether verbose mode is enabled
 * @param jsonOutput - Whether JSON output mode is enabled
 */
function debugLog(message: string, verbose: boolean, jsonOutput: boolean): void {
  if (verbose && !jsonOutput) {
    console.error(colors.muted(`[DEBUG] ${message}`));
  }
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
      const rawValue = kvMatch[2].trim();
      let value: unknown = rawValue;

      // Remove quotes from strings
      if (
        (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
        (rawValue.startsWith("'") && rawValue.endsWith("'"))
      ) {
        value = rawValue.slice(1, -1);
      } // Parse arrays
      else if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
        try {
          value = JSON.parse(rawValue.replace(/'/g, '"'));
        } catch {
          // If JSON parse fails, try manual parsing
          value = rawValue
            .slice(1, -1)
            .split(',')
            .map((s: string) => s.trim().replace(/^["']|["']$/g, ''))
            .filter((s: string) => s);
        }
      } // Parse booleans
      else if (rawValue === 'true') {
        value = true;
      } else if (rawValue === 'false') {
        value = false;
      } // Parse numbers
      else if (/^\d+$/.test(rawValue)) {
        value = parseInt(rawValue, 10);
      } else if (/^\d+\.\d+$/.test(rawValue)) {
        value = parseFloat(rawValue);
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
  if (config.majorLabels.includes(label)) return 'MAJOR';
  if (config.minorLabels.includes(label)) return 'MINOR';
  if (config.patchLabels.includes(label)) return 'PATCH';
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
    majorLabels: ['release'],
    minorLabels: ['feature'],
    patchLabels: ['bugfix', 'fix', 'patch', 'hotfix'],
  };

  try {
    const content = await Deno.readTextFile(configPath);
    const config = parseToml(content);

    if (config.tag) {
      // TOML uses snake_case, convert to camelCase internally
      return {
        majorLabels: (config.tag.major_labels as string[]) || defaults.majorLabels,
        minorLabels: (config.tag.minor_labels as string[]) || defaults.minorLabels,
        patchLabels: (config.tag.patch_labels as string[]) || defaults.patchLabels,
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
  // Initialize flags with defaults - these are used in error handling
  let jsonOutput = false;
  let verbose = false;
  let sourceBranch: string | undefined;
  let targetBranch: string | undefined;
  let configPath = '.github/project.toml';

  try {
    // Extract flags
    sourceBranch = ctx.flags['source-branch'] as string | undefined;
    targetBranch = ctx.flags['target-branch'] as string | undefined;
    configPath = (ctx.flags['config'] as string) || '.github/project.toml';
    jsonOutput = (ctx.flags['json'] as boolean) ?? false;
    verbose = (ctx.flags['verbose'] as boolean) ?? false;
    const dryRun = (ctx.flags['dry-run'] as boolean) ?? false;

    debugLog('Starting auto-tag command', verbose, jsonOutput);
    debugLog(`Flags: source-branch="${sourceBranch}", target-branch="${targetBranch}", config="${configPath}", json=${jsonOutput}, dry-run=${dryRun}`, verbose, jsonOutput);

    // Validate required flags
    if (!sourceBranch) {
      throw new Error('--source-branch is required');
    }

    if (!targetBranch) {
      throw new Error('--target-branch is required');
    }

    // Type narrowing: after validation, these are guaranteed to be strings
    const source: string = sourceBranch;
    const target: string = targetBranch;

    debugLog(`Source branch: "${source}"`, verbose, jsonOutput);
    debugLog(`Target branch: "${target}"`, verbose, jsonOutput);

    // Load configuration
    debugLog(`Loading config from: ${configPath}`, verbose, jsonOutput);
    const config = await loadConfig(configPath);
    debugLog(`Config loaded: majorLabels=${JSON.stringify(config.majorLabels)}, minorLabels=${JSON.stringify(config.minorLabels)}, patchLabels=${JSON.stringify(config.patchLabels)}`, verbose, jsonOutput);

    // Get latest tag
    debugLog('Getting latest git tag...', verbose, jsonOutput);
    const latestTag = await getLatestTag();
    debugLog(`Latest tag: ${latestTag ?? '(none)'}`, verbose, jsonOutput);

    // Parse current version
    const currentVersion = parseVersion(latestTag);
    debugLog(`Parsed version: ${JSON.stringify(currentVersion)}`, verbose, jsonOutput);

    // Check if this is a develop -> main merge
    const isDevelopToMain = target === 'main' && source === 'develop';
    debugLog(`Is develop→main merge: ${isDevelopToMain}`, verbose, jsonOutput);

    // Extract label from source branch
    const label = extractLabel(source);
    debugLog(`Extracted label: "${label}"`, verbose, jsonOutput);

    // Get increment type
    const incrementType = getIncrementType(label, config);
    debugLog(`Increment type: ${incrementType}`, verbose, jsonOutput);

    // Calculate new version
    const newTag = calculateNewVersion(currentVersion, incrementType, target, isDevelopToMain);
    debugLog(`Calculated new tag: ${newTag}`, verbose, jsonOutput);

    const result: AutoTagResult = {
      success: true,
      currentTag: latestTag,
      newTag,
      label,
      incrementType,
      targetBranch: target,
      isDevelopToMain,
    };

    if (jsonOutput) {
      console.log(JSON.stringify(result));
    } else {
      console.log(colors.highlight('\n🏷️  Auto Tag Calculator\n'));
      console.log(`${colors.muted('Current tag:')} ${latestTag || '(none, starting from v0.0.0)'}`);
      console.log(`${colors.muted('Source branch:')} ${source}`);
      console.log(`${colors.muted('Target branch:')} ${target}`);
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
      debugLog(`Creating annotated tag: ${newTag}`, verbose, jsonOutput);
      const tagMessage = `Release ${newTag}`;
      const createCommand = new Deno.Command('git', {
        args: ['tag', '-a', newTag, '-m', tagMessage],
        stdout: 'piped',
        stderr: 'piped',
      });

      const { code: createCode, stderr: createStderr } = await createCommand.output();
      if (createCode !== 0) {
        const errorMsg = new TextDecoder().decode(createStderr).trim();
        debugLog(`git tag failed with code ${createCode}: ${errorMsg}`, verbose, jsonOutput);
        if (errorMsg.includes('already exists')) {
          throw new Error(`Tag ${newTag} already exists. Delete it first or use a different version.`);
        }
        throw new Error(`Failed to create tag: ${errorMsg}`);
      }
      debugLog('Tag created successfully', verbose, jsonOutput);

      // Push tag
      debugLog(`Pushing tag to origin: ${newTag}`, verbose, jsonOutput);
      const pushCommand = new Deno.Command('git', {
        args: ['push', 'origin', newTag],
        stdout: 'piped',
        stderr: 'piped',
      });

      const { code: pushCode, stderr: pushStderr } = await pushCommand.output();
      if (pushCode !== 0) {
        const errorMsg = new TextDecoder().decode(pushStderr).trim();
        debugLog(`git push failed with code ${pushCode}: ${errorMsg}`, verbose, jsonOutput);
        if (errorMsg.includes('Could not resolve host') || errorMsg.includes('Connection refused')) {
          throw new Error(`Network error while pushing tag: ${errorMsg}`);
        }
        throw new Error(`Failed to push tag: ${errorMsg}`);
      }
      debugLog('Tag pushed successfully', verbose, jsonOutput);

      if (!jsonOutput) {
        console.log(colors.success(`✓ Tag ${newTag} created and pushed`));
      }
    } else {
      debugLog('Dry run mode - skipping tag creation', verbose, jsonOutput);
    }

    debugLog('Auto-tag command completed successfully', verbose, jsonOutput);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    debugLog(`Error occurred: ${errorMessage}`, verbose, jsonOutput);

    if (jsonOutput) {
      const errorResult: AutoTagResult = {
        success: false,
        currentTag: null,
        newTag: null,
        label: '',
        incrementType: 'PATCH',
        targetBranch: targetBranch ?? '',
        isDevelopToMain: false,
        error: errorMessage,
        context: {
          sourceBranch: sourceBranch ?? '',
          configPath,
        },
      };
      console.log(JSON.stringify(errorResult));
    } else {
      console.error(colors.error(`\n❌ Error: ${errorMessage}\n`));
      if (sourceBranch || targetBranch) {
        console.error(colors.muted(`Context: source-branch="${sourceBranch ?? ''}", target-branch="${targetBranch ?? ''}", config="${configPath}"`));
      }
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
    {
      short: 'V',
      long: 'verbose',
      description: 'Enable verbose output for debugging (writes to stderr)',
    },
  ],
  action: autoTagAction,
};
