/**
 * Link-issue command for adding issues to GitHub Projects
 *
 * This command adds an issue to a GitHub Project and sets default field values
 * based on the configuration in project.toml.
 *
 * Used by GitHub Actions to automatically link issues to projects.
 *
 * @module
 */

import type { Command, CommandContext } from '../types.ts';
import * as colors from '../colors.ts';
import {
  addIssueToProject,
  findField,
  findIteration,
  findOption,
  getGitHubToken,
  getIssueNodeId,
  getProject,
  updateItemField,
} from '../../lib/github-project.ts';

/**
 * Result of the link-issue operation
 */
interface LinkIssueResult {
  success: boolean;
  issueNumber: number;
  projectItemId?: string;
  projectTitle?: string;
  fieldsSet?: string[];
  error?: string;
  context?: {
    repo: string;
    configPath: string;
  };
}

/**
 * Parsed configuration for defaults section
 */
interface DefaultsConfig {
  status?: string;
  priority?: string;
  iteration?: string;
  size?: number;
  estimate?: number;
  startDate?: string;
  targetDate?: string;
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
 * Load project configuration from TOML file
 */
async function loadConfig(
  configPath: string,
): Promise<{ projectUrl: string; defaults: DefaultsConfig }> {
  const content = await Deno.readTextFile(configPath);
  const config = parseToml(content);

  if (!config.project?.url) {
    throw new Error('project.url is required in configuration');
  }

  const defaults: DefaultsConfig = {};
  if (config.defaults) {
    defaults.status = config.defaults.status as string | undefined;
    defaults.priority = config.defaults.priority as string | undefined;
    defaults.iteration = config.defaults.iteration as string | undefined;
    defaults.size = config.defaults.size as number | undefined;
    defaults.estimate = config.defaults.estimate as number | undefined;
    defaults.startDate = config.defaults.start_date as string | undefined;
    defaults.targetDate = config.defaults.target_date as string | undefined;
  }

  return {
    projectUrl: config.project.url as string,
    defaults,
  };
}

/**
 * Action handler for the link-issue command
 */
async function linkIssueAction(ctx: CommandContext): Promise<void> {
  let jsonOutput = false;
  let verbose = false;
  let issueNumber = 0;
  let repo = '';
  let configPath = '.github/project.toml';

  try {
    // Extract flags
    issueNumber = parseInt(ctx.flags['issue-number'] as string, 10);
    repo = ctx.flags['repo'] as string;
    configPath = (ctx.flags['config'] as string) || '.github/project.toml';
    jsonOutput = (ctx.flags['json'] as boolean) ?? false;
    verbose = (ctx.flags['verbose'] as boolean) ?? false;

    debugLog('Starting link-issue command', verbose, jsonOutput);
    debugLog(
      `Flags: issue-number=${issueNumber}, repo="${repo}", config="${configPath}"`,
      verbose,
      jsonOutput,
    );

    // Validate required flags
    if (!issueNumber || isNaN(issueNumber)) {
      throw new Error('--issue-number is required and must be a valid number');
    }

    if (!repo) {
      throw new Error('--repo is required (format: owner/repo)');
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
    const { projectUrl, defaults } = await loadConfig(configPath);
    debugLog(`Project URL: ${projectUrl}`, verbose, jsonOutput);
    debugLog(`Defaults: ${JSON.stringify(defaults)}`, verbose, jsonOutput);

    // Get project info
    debugLog('Fetching project information...', verbose, jsonOutput);
    const project = await getProject(projectUrl, token);
    debugLog(`Project: ${project.title} (${project.id})`, verbose, jsonOutput);

    // Get issue node ID
    debugLog(`Getting issue #${issueNumber} node ID...`, verbose, jsonOutput);
    const issueNodeId = await getIssueNodeId(owner, repoName, issueNumber, token);
    debugLog(`Issue node ID: ${issueNodeId}`, verbose, jsonOutput);

    // Add issue to project
    debugLog('Adding issue to project...', verbose, jsonOutput);
    const itemId = await addIssueToProject(project.id, issueNodeId, token);
    debugLog(`Project item ID: ${itemId}`, verbose, jsonOutput);

    // Set default field values
    const fieldsSet: string[] = [];

    // Set Status
    if (defaults.status) {
      const statusField = findField(project.fields, 'Status');
      if (statusField) {
        const option = findOption(statusField, defaults.status);
        if (option) {
          debugLog(`Setting Status to: ${defaults.status}`, verbose, jsonOutput);
          await updateItemField(
            {
              projectId: project.id,
              itemId,
              fieldId: statusField.id,
              value: { singleSelectOptionId: option.id },
            },
            token,
          );
          fieldsSet.push('Status');
        } else {
          debugLog(`Warning: Status option '${defaults.status}' not found`, verbose, jsonOutput);
        }
      }
    }

    // Set Priority
    if (defaults.priority) {
      const priorityField = findField(project.fields, 'Priority');
      if (priorityField) {
        const option = findOption(priorityField, defaults.priority);
        if (option) {
          debugLog(`Setting Priority to: ${defaults.priority}`, verbose, jsonOutput);
          await updateItemField(
            {
              projectId: project.id,
              itemId,
              fieldId: priorityField.id,
              value: { singleSelectOptionId: option.id },
            },
            token,
          );
          fieldsSet.push('Priority');
        } else {
          debugLog(
            `Warning: Priority option '${defaults.priority}' not found`,
            verbose,
            jsonOutput,
          );
        }
      }
    }

    // Set Iteration
    if (defaults.iteration) {
      const iterationField = findField(project.fields, 'Iteration');
      if (iterationField?.iterations) {
        const iteration = findIteration(iterationField, defaults.iteration);
        if (iteration) {
          debugLog(`Setting Iteration to: ${defaults.iteration}`, verbose, jsonOutput);
          await updateItemField(
            {
              projectId: project.id,
              itemId,
              fieldId: iterationField.id,
              value: { iterationId: iteration.id },
            },
            token,
          );
          fieldsSet.push('Iteration');
        } else {
          debugLog(
            `Warning: Iteration '${defaults.iteration}' not found`,
            verbose,
            jsonOutput,
          );
        }
      }
    }

    // Set Size (number field)
    if (defaults.size !== undefined) {
      const sizeField = findField(project.fields, 'Size');
      if (sizeField) {
        debugLog(`Setting Size to: ${defaults.size}`, verbose, jsonOutput);
        await updateItemField(
          {
            projectId: project.id,
            itemId,
            fieldId: sizeField.id,
            value: { number: defaults.size },
          },
          token,
        );
        fieldsSet.push('Size');
      }
    }

    // Set Estimate (number field)
    if (defaults.estimate !== undefined) {
      const estimateField = findField(project.fields, 'Estimate');
      if (estimateField) {
        debugLog(`Setting Estimate to: ${defaults.estimate}`, verbose, jsonOutput);
        await updateItemField(
          {
            projectId: project.id,
            itemId,
            fieldId: estimateField.id,
            value: { number: defaults.estimate },
          },
          token,
        );
        fieldsSet.push('Estimate');
      }
    }

    // Set Start date
    if (defaults.startDate) {
      const startDateField = findField(project.fields, 'Start date');
      if (startDateField) {
        debugLog(`Setting Start date to: ${defaults.startDate}`, verbose, jsonOutput);
        await updateItemField(
          {
            projectId: project.id,
            itemId,
            fieldId: startDateField.id,
            value: { date: defaults.startDate },
          },
          token,
        );
        fieldsSet.push('Start date');
      }
    }

    // Set Target date
    if (defaults.targetDate) {
      const targetDateField = findField(project.fields, 'Target date');
      if (targetDateField) {
        debugLog(`Setting Target date to: ${defaults.targetDate}`, verbose, jsonOutput);
        await updateItemField(
          {
            projectId: project.id,
            itemId,
            fieldId: targetDateField.id,
            value: { date: defaults.targetDate },
          },
          token,
        );
        fieldsSet.push('Target date');
      }
    }

    const result: LinkIssueResult = {
      success: true,
      issueNumber,
      projectItemId: itemId,
      projectTitle: project.title,
      fieldsSet,
    };

    // Output
    if (jsonOutput) {
      console.log(JSON.stringify(result));
    } else {
      console.log(colors.highlight('\n🔗 Link Issue to Project\n'));
      console.log(`${colors.muted('Issue:')} #${issueNumber}`);
      console.log(`${colors.muted('Repository:')} ${repo}`);
      console.log(`${colors.muted('Project:')} ${project.title}`);
      console.log(`${colors.muted('Item ID:')} ${itemId}`);
      if (fieldsSet.length > 0) {
        console.log(`${colors.muted('Fields set:')} ${fieldsSet.join(', ')}`);
      }
      console.log();
      console.log(colors.success(`✓ Issue #${issueNumber} added to project`));
    }

    debugLog('Link-issue command completed successfully', verbose, jsonOutput);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    debugLog(`Error occurred: ${errorMessage}`, verbose, jsonOutput);

    if (jsonOutput) {
      const errorResult: LinkIssueResult = {
        success: false,
        issueNumber,
        error: errorMessage,
        context: {
          repo,
          configPath,
        },
      };
      console.log(JSON.stringify(errorResult));
    } else {
      console.error(colors.error(`\n❌ Error: ${errorMessage}\n`));
      if (repo || issueNumber) {
        console.error(
          colors.muted(
            `Context: issue-number=${issueNumber}, repo="${repo}", config="${configPath}"`,
          ),
        );
      }
    }
    Deno.exit(1);
  }
}

/**
 * Link-issue command definition
 *
 * Adds an issue to a GitHub Project and sets default field values.
 *
 * @example
 * ```bash
 * # Add issue to project
 * hewg link-issue --issue-number 123 --repo owner/repo --json
 *
 * # With custom config path
 * hewg link-issue -i 123 -r owner/repo -c .github/project.toml --json
 * ```
 */
export const linkIssueCommand: Command = {
  name: 'link-issue',
  description: 'Add an issue to a GitHub Project with default field values',
  flags: [
    {
      short: 'i',
      long: 'issue-number',
      description: 'Issue number to add to project',
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
  action: linkIssueAction,
};

// Export internal functions for testing
export const _internals = {
  parseToml,
  loadConfig,
};
