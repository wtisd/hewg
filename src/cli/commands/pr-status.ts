/**
 * PR-status command for updating issue status on pull request events
 *
 * This command extracts issue numbers from PR branch names and body,
 * then updates the status of linked issues in a GitHub Project.
 *
 * Used by GitHub Actions to automatically update issue status when PRs are opened.
 *
 * @module
 */

import type { Command, CommandContext } from '../types.ts';
import * as colors from '../colors.ts';
import {
  addIssueToProject,
  findField,
  findOption,
  getGitHubToken,
  getIssueNodeId,
  getProject,
  getProjectItems,
  updateItemField,
} from '../../lib/github-project.ts';

/**
 * Result of the pr-status operation
 */
interface PrStatusResult {
  success: boolean;
  prNumber: number;
  processedIssues: number[];
  failedIssues: number[];
  skippedIssues: number[];
  newStatus: string;
  isDraft: boolean;
  skippedDraft: boolean;
  error?: string;
  context?: {
    repo: string;
    branch: string;
    configPath: string;
  };
}

/**
 * Parsed configuration for pr section
 */
interface PrConfig {
  reviewStatus: string;
  branchPattern: string;
  ignoreDraft: boolean;
}

/**
 * Log a debug message to stderr (to not interfere with JSON output on stdout)
 */
function debugLog(message: string, verbose: boolean, jsonOutput: boolean): void {
  if (verbose && !jsonOutput) {
    console.error(colors.muted(`[DEBUG] ${message}`));
  }
}

/**
 * Parse a TOML file content (simple parser for our use case)
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
 * Extract issue numbers from branch name using configurable pattern
 *
 * @param branchName - The branch name to parse
 * @param pattern - Regular expression pattern with capture group for issue number
 * @returns Array of extracted issue numbers
 *
 * @example
 * ```ts
 * extractFromBranch("feature/alice/123/add-auth", "^[^/]+/[^/]+/(\\d+)/.*$")
 * // [123]
 * ```
 */
function extractFromBranch(branchName: string, pattern: string): number[] {
  try {
    const regex = new RegExp(pattern);
    const match = branchName.match(regex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (num > 0) return [num];
    }
  } catch {
    // Invalid pattern, return empty array
  }
  return [];
}

/**
 * Extract issue numbers from PR body using GitHub keywords
 *
 * Keywords: close[sd], fix(e[sd])?, resolve[sd]
 *
 * @param body - PR body text
 * @returns Array of extracted issue numbers (deduplicated)
 *
 * @example
 * ```ts
 * extractFromBody("Fixes #123, Closes #456")
 * // [123, 456]
 * ```
 */
function extractFromBody(body: string): number[] {
  if (!body) return [];

  const regex = /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi;
  const issues: number[] = [];
  let match;

  while ((match = regex.exec(body)) !== null) {
    const num = parseInt(match[1], 10);
    if (num > 0 && !issues.includes(num)) {
      issues.push(num);
    }
  }

  return issues;
}

/**
 * Load project configuration from TOML file
 */
async function loadConfig(configPath: string): Promise<{ projectUrl: string; pr: PrConfig }> {
  const content = await Deno.readTextFile(configPath);
  const config = parseToml(content);

  if (!config.project?.url) {
    throw new Error('project.url is required in configuration');
  }

  // Default PR config values
  const prConfig: PrConfig = {
    reviewStatus: 'In Review',
    branchPattern: '^[^/]+/[^/]+/(\\d+)/.*$',
    ignoreDraft: false,
  };

  if (config.pr) {
    prConfig.reviewStatus = (config.pr.review_status as string) ?? prConfig.reviewStatus;
    prConfig.branchPattern = (config.pr.branch_pattern as string) ?? prConfig.branchPattern;
    prConfig.ignoreDraft = (config.pr.ignore_draft as boolean) ?? prConfig.ignoreDraft;
  }

  return {
    projectUrl: config.project.url as string,
    pr: prConfig,
  };
}

/**
 * Action handler for the pr-status command
 */
async function prStatusAction(ctx: CommandContext): Promise<void> {
  let jsonOutput = false;
  let verbose = false;
  let prNumber = 0;
  let repo = '';
  let branch = '';
  let configPath = '.github/project.toml';

  try {
    // Extract flags
    prNumber = parseInt(ctx.flags['pr-number'] as string, 10);
    repo = ctx.flags['repo'] as string;
    branch = ctx.flags['branch'] as string;
    const body = (ctx.flags['body'] as string) || '';
    const isDraft = (ctx.flags['draft'] as boolean) ?? false;
    configPath = (ctx.flags['config'] as string) || '.github/project.toml';
    jsonOutput = (ctx.flags['json'] as boolean) ?? false;
    verbose = (ctx.flags['verbose'] as boolean) ?? false;

    debugLog('Starting pr-status command', verbose, jsonOutput);
    debugLog(
      `Flags: pr-number=${prNumber}, repo="${repo}", branch="${branch}", draft=${isDraft}`,
      verbose,
      jsonOutput,
    );

    // Validate required flags
    if (!prNumber || isNaN(prNumber)) {
      throw new Error('--pr-number is required and must be a valid number');
    }

    if (!repo) {
      throw new Error('--repo is required (format: owner/repo)');
    }

    if (!branch) {
      throw new Error('--branch is required');
    }

    const [owner, repoName] = repo.split('/');
    if (!owner || !repoName) {
      throw new Error('--repo must be in the format owner/repo');
    }

    // Get GitHub token
    debugLog('Getting GitHub token...', verbose, jsonOutput);
    const token = getGitHubToken();

    // Load configuration
    debugLog(`Loading config from: ${configPath}`, verbose, jsonOutput);
    const { projectUrl, pr: prConfig } = await loadConfig(configPath);
    debugLog(`Project URL: ${projectUrl}`, verbose, jsonOutput);
    debugLog(`PR Config: ${JSON.stringify(prConfig)}`, verbose, jsonOutput);

    // Check if draft PR should be skipped
    if (isDraft && prConfig.ignoreDraft) {
      debugLog('Skipping draft PR (ignore_draft is enabled)', verbose, jsonOutput);

      const result: PrStatusResult = {
        success: true,
        prNumber,
        processedIssues: [],
        failedIssues: [],
        skippedIssues: [],
        newStatus: prConfig.reviewStatus,
        isDraft: true,
        skippedDraft: true,
      };

      if (jsonOutput) {
        console.log(JSON.stringify(result));
      } else {
        console.log(colors.info('\n📋 PR Status Update\n'));
        console.log(colors.muted('Skipped: Draft PR (ignore_draft is enabled)'));
      }
      return;
    }

    // Extract issue numbers
    debugLog(`Extracting issues from branch: ${branch}`, verbose, jsonOutput);
    const branchIssues = extractFromBranch(branch, prConfig.branchPattern);
    debugLog(`Issues from branch: ${branchIssues.join(', ') || 'none'}`, verbose, jsonOutput);

    debugLog('Extracting issues from PR body', verbose, jsonOutput);
    const bodyIssues = extractFromBody(body);
    debugLog(`Issues from body: ${bodyIssues.join(', ') || 'none'}`, verbose, jsonOutput);

    // Combine and deduplicate
    const allIssues = [...new Set([...branchIssues, ...bodyIssues])];
    debugLog(`All issues to process: ${allIssues.join(', ') || 'none'}`, verbose, jsonOutput);

    if (allIssues.length === 0) {
      const result: PrStatusResult = {
        success: true,
        prNumber,
        processedIssues: [],
        failedIssues: [],
        skippedIssues: [],
        newStatus: prConfig.reviewStatus,
        isDraft,
        skippedDraft: false,
      };

      if (jsonOutput) {
        console.log(JSON.stringify(result));
      } else {
        console.log(colors.info('\n📋 PR Status Update\n'));
        console.log(colors.warn('No issue numbers found in branch name or PR body'));
        console.log(colors.muted(`Branch: ${branch}`));
        console.log(colors.muted(`Pattern: ${prConfig.branchPattern}`));
      }
      return;
    }

    // Get project info
    debugLog('Fetching project information...', verbose, jsonOutput);
    const project = await getProject(projectUrl, token);
    debugLog(`Project: ${project.title} (${project.id})`, verbose, jsonOutput);

    // Find Status field and option
    const statusField = findField(project.fields, 'Status');
    if (!statusField) {
      throw new Error('Status field not found in project');
    }

    const statusOption = findOption(statusField, prConfig.reviewStatus);
    if (!statusOption) {
      const availableOptions = statusField.options?.map((o) => o.name).join(', ') || 'none';
      throw new Error(
        `Status option "${prConfig.reviewStatus}" not found. Available: ${availableOptions}`,
      );
    }
    debugLog(
      `Status field: ${statusField.id}, Option: ${statusOption.name} (${statusOption.id})`,
      verbose,
      jsonOutput,
    );

    // Get existing project items
    debugLog('Fetching project items...', verbose, jsonOutput);
    const existingItems = await getProjectItems(project.id, token);
    const existingIssueMap = new Map(
      existingItems.filter((i) => i.issueNumber).map((i) => [i.issueNumber!, i.id]),
    );
    debugLog(`Found ${existingItems.length} items in project`, verbose, jsonOutput);

    // Process each issue
    const processedIssues: number[] = [];
    const failedIssues: number[] = [];
    const skippedIssues: number[] = [];

    for (const issueNumber of allIssues) {
      try {
        debugLog(`\nProcessing Issue #${issueNumber}...`, verbose, jsonOutput);

        // Get issue node ID
        const issueNodeId = await getIssueNodeId(owner, repoName, issueNumber, token);
        debugLog(`Issue node ID: ${issueNodeId}`, verbose, jsonOutput);

        // Check if issue is already in project
        let itemId = existingIssueMap.get(issueNumber);

        if (!itemId) {
          // Add issue to project
          debugLog(`Issue #${issueNumber} not in project, adding...`, verbose, jsonOutput);
          itemId = await addIssueToProject(project.id, issueNodeId, token);
          debugLog(`Added Issue #${issueNumber} to project, item ID: ${itemId}`, verbose, jsonOutput);
        } else {
          debugLog(
            `Issue #${issueNumber} already in project, item ID: ${itemId}`,
            verbose,
            jsonOutput,
          );
        }

        // Update Status
        await updateItemField(
          {
            projectId: project.id,
            itemId,
            fieldId: statusField.id,
            value: { singleSelectOptionId: statusOption.id },
          },
          token,
        );
        debugLog(
          `Updated Issue #${issueNumber} status to: ${prConfig.reviewStatus}`,
          verbose,
          jsonOutput,
        );
        processedIssues.push(issueNumber);
      } catch (issueError) {
        const errorMsg = issueError instanceof Error ? issueError.message : String(issueError);
        debugLog(`Error processing Issue #${issueNumber}: ${errorMsg}`, verbose, jsonOutput);
        failedIssues.push(issueNumber);
      }
    }

    const result: PrStatusResult = {
      success: failedIssues.length === 0,
      prNumber,
      processedIssues,
      failedIssues,
      skippedIssues,
      newStatus: prConfig.reviewStatus,
      isDraft,
      skippedDraft: false,
    };

    // Output
    if (jsonOutput) {
      console.log(JSON.stringify(result));
    } else {
      console.log(colors.highlight('\n📋 PR Status Update\n'));
      console.log(`${colors.muted('PR:')} #${prNumber}`);
      console.log(`${colors.muted('Repository:')} ${repo}`);
      console.log(`${colors.muted('Branch:')} ${branch}`);
      console.log(`${colors.muted('Project:')} ${project.title}`);
      console.log(`${colors.muted('New Status:')} ${prConfig.reviewStatus}`);
      console.log();
      console.log(`${colors.muted('Processed:')} ${processedIssues.length} issues`);
      if (processedIssues.length > 0) {
        console.log(
          `  ${colors.success('✓')} ${processedIssues.map((i) => `#${i}`).join(', ')}`,
        );
      }
      if (failedIssues.length > 0) {
        console.log(`${colors.muted('Failed:')} ${failedIssues.length} issues`);
        console.log(`  ${colors.error('✗')} ${failedIssues.map((i) => `#${i}`).join(', ')}`);
      }
    }

    debugLog('PR-status command completed', verbose, jsonOutput);

    // Exit with error if any issues failed
    if (failedIssues.length > 0 && processedIssues.length === 0) {
      Deno.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    debugLog(`Error occurred: ${errorMessage}`, verbose, jsonOutput);

    if (jsonOutput) {
      const errorResult: PrStatusResult = {
        success: false,
        prNumber,
        processedIssues: [],
        failedIssues: [],
        skippedIssues: [],
        newStatus: '',
        isDraft: false,
        skippedDraft: false,
        error: errorMessage,
        context: {
          repo,
          branch,
          configPath,
        },
      };
      console.log(JSON.stringify(errorResult));
    } else {
      console.error(colors.error(`\n❌ Error: ${errorMessage}\n`));
      if (repo || prNumber) {
        console.error(
          colors.muted(
            `Context: pr-number=${prNumber}, repo="${repo}", branch="${branch}", config="${configPath}"`,
          ),
        );
      }
    }
    Deno.exit(1);
  }
}

/**
 * PR-status command definition
 *
 * Updates issue status when a pull request is opened or reopened.
 *
 * @example
 * ```bash
 * # Update linked issues status
 * hewg pr-status --pr-number 45 --repo owner/repo --branch feature/alice/123/add-auth --json
 *
 * # With PR body and draft flag
 * hewg pr-status -p 45 -r owner/repo -b feature/alice/123/add-auth --body "Fixes #123" --draft --json
 * ```
 */
export const prStatusCommand: Command = {
  name: 'pr-status',
  description: 'Update issue status when a pull request is opened or reopened',
  flags: [
    {
      short: 'p',
      long: 'pr-number',
      description: 'Pull request number',
      takesValue: true,
      required: true,
    },
    {
      short: 'r',
      long: 'repo',
      description: 'Repository in owner/repo format',
      takesValue: true,
      required: true,
    },
    {
      short: 'b',
      long: 'branch',
      description: 'Source branch name (PR head branch)',
      takesValue: true,
      required: true,
    },
    {
      long: 'body',
      description: 'PR body text for extracting issue numbers',
      takesValue: true,
    },
    {
      short: 'd',
      long: 'draft',
      description: 'Whether the PR is a draft',
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
      short: 'V',
      long: 'verbose',
      description: 'Enable verbose output for debugging (writes to stderr)',
    },
  ],
  action: prStatusAction,
};

// Export internal functions for testing
export const _internals = {
  parseToml,
  extractFromBranch,
  extractFromBody,
  loadConfig,
};
