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
  getCurrentIteration,
  getGitHubToken,
  getIssueNodeId,
  getProject,
  updateItemField,
} from '../../lib/github-project.ts';

/**
 * Warning about field setting failure
 */
interface FieldWarning {
  field: string;
  reason: string;
  configuredValue?: string;
}

/**
 * Result of the link-issue operation
 */
interface LinkIssueResult {
  success: boolean;
  issueNumber: number;
  projectItemId?: string;
  projectTitle?: string;
  fieldsSet?: string[];
  fieldWarnings?: FieldWarning[];
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
  useCurrentIteration?: boolean;
  useCurrentDate?: boolean;
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
    defaults.useCurrentIteration = config.defaults.use_current_iteration as boolean | undefined;
    defaults.useCurrentDate = config.defaults.use_current_date as boolean | undefined;
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
    const fieldWarnings: FieldWarning[] = [];

    // Helper to add warning
    const addWarning = (field: string, reason: string, configuredValue?: string) => {
      fieldWarnings.push({ field, reason, configuredValue });
      debugLog(
        `Warning: ${field} - ${reason}${
          configuredValue ? ` (configured: ${configuredValue})` : ''
        }`,
        verbose,
        jsonOutput,
      );
    };

    // Log available fields for debugging
    debugLog(
      `Available fields in project: ${
        project.fields.map((f) => `${f.name}(${f.type || 'unknown'})`).join(', ')
      }`,
      verbose,
      jsonOutput,
    );

    // Set Status
    if (defaults.status) {
      const statusField = findField(project.fields, 'Status');
      if (statusField) {
        if (statusField.options && statusField.options.length > 0) {
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
            const availableOptions = statusField.options.map((o) => o.name).join(', ');
            addWarning(
              'Status',
              `Option '${defaults.status}' not found. Available: ${availableOptions}`,
              defaults.status,
            );
          }
        } else {
          addWarning('Status', 'Field has no options configured', defaults.status);
        }
      } else {
        addWarning('Status', 'Field not found in project', defaults.status);
      }
    }

    // Set Priority
    if (defaults.priority) {
      const priorityField = findField(project.fields, 'Priority');
      if (priorityField) {
        if (priorityField.options && priorityField.options.length > 0) {
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
            const availableOptions = priorityField.options.map((o) => o.name).join(', ');
            addWarning(
              'Priority',
              `Option '${defaults.priority}' not found. Available: ${availableOptions}`,
              defaults.priority,
            );
          }
        } else {
          addWarning('Priority', 'Field has no options configured', defaults.priority);
        }
      } else {
        addWarning('Priority', 'Field not found in project', defaults.priority);
      }
    }

    // Set Iteration (static value takes priority over dynamic)
    if (defaults.iteration || defaults.useCurrentIteration) {
      const iterationField = findField(project.fields, 'Iteration');
      if (iterationField) {
        if (iterationField.iterations && iterationField.iterations.length > 0) {
          let iteration;
          let iterationSource: string = '';

          if (defaults.iteration) {
            // Static iteration specified - use it
            iteration = findIteration(iterationField, defaults.iteration);
            iterationSource = defaults.iteration;
            if (!iteration) {
              const availableIterations = iterationField.iterations.map((i) => i.title).join(', ');
              addWarning(
                'Iteration',
                `Iteration '${defaults.iteration}' not found. Available: ${availableIterations}`,
                defaults.iteration,
              );
            }
          } else if (defaults.useCurrentIteration) {
            // Use current iteration based on date
            iteration = getCurrentIteration(iterationField);
            iterationSource = iteration?.title ?? 'current';
            if (!iteration) {
              addWarning(
                'Iteration',
                'Could not determine current iteration (no iterations with date info)',
              );
            }
          }

          if (iteration) {
            debugLog(`Setting Iteration to: ${iterationSource}`, verbose, jsonOutput);
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
          }
        } else {
          addWarning(
            'Iteration',
            'Field has no iterations configured',
            defaults.iteration ?? 'use_current_iteration',
          );
        }
      } else {
        addWarning(
          'Iteration',
          'Field not found in project',
          defaults.iteration ?? 'use_current_iteration',
        );
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
      } else {
        addWarning('Size', 'Field not found in project', String(defaults.size));
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
      } else {
        addWarning('Estimate', 'Field not found in project', String(defaults.estimate));
      }
    }

    // Set Start date (static value takes priority over dynamic)
    if (defaults.startDate || defaults.useCurrentDate) {
      const startDateField = findField(project.fields, 'Start date');
      if (startDateField) {
        let dateValue: string;

        if (defaults.startDate) {
          // Static date specified - use it
          dateValue = defaults.startDate;
        } else {
          // Use current date (YYYY-MM-DD format)
          const today = new Date();
          dateValue = today.toISOString().split('T')[0];
        }

        debugLog(`Setting Start date to: ${dateValue}`, verbose, jsonOutput);
        await updateItemField(
          {
            projectId: project.id,
            itemId,
            fieldId: startDateField.id,
            value: { date: dateValue },
          },
          token,
        );
        fieldsSet.push('Start date');
      } else {
        addWarning(
          'Start date',
          'Field not found in project',
          defaults.startDate ?? 'use_current_date',
        );
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
      } else {
        addWarning('Target date', 'Field not found in project', defaults.targetDate);
      }
    }

    // Determine success based on whether all configured fields were set
    const hasWarnings = fieldWarnings.length > 0;
    const result: LinkIssueResult = {
      success: !hasWarnings, // Only fully successful if no warnings
      issueNumber,
      projectItemId: itemId,
      projectTitle: project.title,
      fieldsSet,
      fieldWarnings: hasWarnings ? fieldWarnings : undefined,
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
      if (hasWarnings) {
        console.log();
        console.log(colors.warn('⚠ Field warnings:'));
        for (const warning of fieldWarnings) {
          console.log(colors.warn(`  - ${warning.field}: ${warning.reason}`));
        }
      }
      console.log();
      if (hasWarnings) {
        console.log(colors.warn(`⚠ Issue #${issueNumber} added to project with warnings`));
      } else {
        console.log(colors.success(`✓ Issue #${issueNumber} added to project`));
      }
    }

    debugLog('Link-issue command completed successfully', verbose, jsonOutput);

    // Exit with error code if there were warnings (so workflow can detect partial failure)
    if (hasWarnings) {
      Deno.exit(1);
    }
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
