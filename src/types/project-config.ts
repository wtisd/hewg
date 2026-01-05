/**
 * GitHub Project configuration types
 *
 * This module defines the types for the `.github/project.toml` configuration file
 * used by the GitHub Actions workflows:
 * - Issue-to-Project: Automatically adds new Issues to a GitHub Project
 * - PR Status Update: Updates Issue status when a PR is opened/reopened
 *
 * @module
 */

/**
 * Valid status values for GitHub Project items
 */
export type StatusValue = 'Planned' | 'Ready' | 'In Progress' | 'In Review' | 'Done';

/**
 * Valid priority values for GitHub Project items
 */
export type PriorityValue = 'P0' | 'P1' | 'P2';

/**
 * Default field values for new Project items
 */
export interface ProjectDefaults {
  /** Status field initial value */
  status?: StatusValue;

  /** Priority field initial value */
  priority?: PriorityValue;

  /** Iteration/Sprint name */
  iteration?: string;

  /** Size estimate (story points, t-shirt size number, etc.) */
  size?: number;

  /** Time estimate in hours or days */
  estimate?: number;

  /** Start date in YYYY-MM-DD format (maps to start_date in TOML) */
  startDate?: string;

  /** Target date in YYYY-MM-DD format (maps to target_date in TOML) */
  targetDate?: string;
}

/**
 * Project section of the configuration
 */
export interface ProjectSection {
  /** GitHub Project URL (e.g., https://github.com/users/{owner}/projects/{number}) */
  url: string;
}

/**
 * Pull Request related configuration
 *
 * Controls the behavior of the pr-status-update workflow
 */
export interface PrConfig {
  /**
   * Status to set when a PR is opened or reopened
   * Must match an existing status option in the Project
   * @default "In Review"
   */
  reviewStatus?: string;

  /**
   * Regular expression pattern for extracting Issue numbers from branch names
   * The first capture group should contain the Issue number
   * @default "^[^/]+/[^/]+/(\\d+)/.*$" (matches label/author/{issue_number}/title)
   */
  branchPattern?: string;

  /**
   * Whether to skip Draft PRs
   * @default false
   */
  ignoreDraft?: boolean;
}

/**
 * Complete project configuration structure
 *
 * @example
 * ```toml
 * [project]
 * url = "https://github.com/users/myuser/projects/1"
 *
 * [defaults]
 * status = "Planned"
 * priority = "P1"
 *
 * [pr]
 * review_status = "In Review"
 * branch_pattern = "^[^/]+/[^/]+/(\\d+)/.*$"
 * ignore_draft = false
 * ```
 */
export interface ProjectConfig {
  /** Project section containing the project URL */
  project: ProjectSection;

  /** Optional default field values for new Issues */
  defaults?: ProjectDefaults;

  /** Optional PR-related configuration */
  pr?: PrConfig;
}

/**
 * Parsed project URL information
 */
export interface ParsedProjectUrl {
  /** Project owner (user or organization) */
  owner: string;

  /** Project number */
  number: number;

  /** Whether the owner is an organization */
  isOrg: boolean;
}

/**
 * Parse a GitHub Project URL into its components
 *
 * @param url - The GitHub Project URL to parse
 * @returns Parsed URL components
 * @throws {Error} If the URL format is invalid
 *
 * @example
 * ```ts
 * const parsed = parseProjectUrl("https://github.com/users/myuser/projects/1");
 * // { owner: "myuser", number: 1, isOrg: false }
 *
 * const orgParsed = parseProjectUrl("https://github.com/orgs/myorg/projects/5");
 * // { owner: "myorg", number: 5, isOrg: true }
 * ```
 */
export function parseProjectUrl(url: string): ParsedProjectUrl {
  // Match user projects: https://github.com/users/{owner}/projects/{number}
  const userMatch = url.match(/github\.com\/users\/([^/]+)\/projects\/(\d+)/);
  if (userMatch) {
    return {
      owner: userMatch[1],
      number: parseInt(userMatch[2], 10),
      isOrg: false,
    };
  }

  // Match org projects: https://github.com/orgs/{owner}/projects/{number}
  const orgMatch = url.match(/github\.com\/orgs\/([^/]+)\/projects\/(\d+)/);
  if (orgMatch) {
    return {
      owner: orgMatch[1],
      number: parseInt(orgMatch[2], 10),
      isOrg: true,
    };
  }

  throw new Error(
    `Invalid project URL format: ${url}. Expected format: https://github.com/users/{owner}/projects/{number} or https://github.com/orgs/{org}/projects/{number}`,
  );
}

/**
 * Validate a project configuration object
 *
 * @param config - The configuration object to validate
 * @throws {Error} If the configuration is invalid
 *
 * @example
 * ```ts
 * validateProjectConfig({
 *   project: { url: "https://github.com/users/myuser/projects/1" },
 *   defaults: { status: "Planned" }
 * });
 * ```
 */
export function validateProjectConfig(config: unknown): asserts config is ProjectConfig {
  if (typeof config !== 'object' || config === null) {
    throw new Error('Configuration must be an object');
  }

  const cfg = config as Record<string, unknown>;

  if (!cfg.project || typeof cfg.project !== 'object') {
    throw new Error('Configuration must have a [project] section');
  }

  const project = cfg.project as Record<string, unknown>;
  if (typeof project.url !== 'string' || !project.url) {
    throw new Error('project.url is required and must be a string');
  }

  // Validate URL format by attempting to parse it
  parseProjectUrl(project.url);

  // Validate defaults if present
  if (cfg.defaults !== undefined) {
    if (typeof cfg.defaults !== 'object' || cfg.defaults === null) {
      throw new Error('defaults must be an object');
    }

    const defaults = cfg.defaults as Record<string, unknown>;

    // Validate status
    if (defaults.status !== undefined) {
      const validStatuses: StatusValue[] = ['Planned', 'Ready', 'In Progress', 'In Review', 'Done'];
      if (!validStatuses.includes(defaults.status as StatusValue)) {
        throw new Error(
          `Invalid status: ${defaults.status}. Must be one of: ${validStatuses.join(', ')}`,
        );
      }
    }

    // Validate priority
    if (defaults.priority !== undefined) {
      const validPriorities: PriorityValue[] = ['P0', 'P1', 'P2'];
      if (!validPriorities.includes(defaults.priority as PriorityValue)) {
        throw new Error(
          `Invalid priority: ${defaults.priority}. Must be one of: ${validPriorities.join(', ')}`,
        );
      }
    }

    // Validate numeric fields
    if (defaults.size !== undefined && typeof defaults.size !== 'number') {
      throw new Error('defaults.size must be a number');
    }
    if (defaults.estimate !== undefined && typeof defaults.estimate !== 'number') {
      throw new Error('defaults.estimate must be a number');
    }

    // Validate date fields (TOML uses snake_case: start_date, target_date)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const startDate = (defaults as Record<string, unknown>)['start_date'];
    if (startDate !== undefined) {
      if (typeof startDate !== 'string' || !dateRegex.test(startDate)) {
        throw new Error('defaults.start_date must be in YYYY-MM-DD format');
      }
    }
    const targetDate = (defaults as Record<string, unknown>)['target_date'];
    if (targetDate !== undefined) {
      if (typeof targetDate !== 'string' || !dateRegex.test(targetDate)) {
        throw new Error('defaults.target_date must be in YYYY-MM-DD format');
      }
    }
  }

  // Validate pr section if present
  if (cfg.pr !== undefined) {
    if (typeof cfg.pr !== 'object' || cfg.pr === null) {
      throw new Error('pr must be an object');
    }

    const pr = cfg.pr as Record<string, unknown>;

    // Validate review_status (TOML uses snake_case)
    const reviewStatus = pr['review_status'];
    if (reviewStatus !== undefined && typeof reviewStatus !== 'string') {
      throw new Error('pr.review_status must be a string');
    }

    // Validate branch_pattern
    const branchPattern = pr['branch_pattern'];
    if (branchPattern !== undefined) {
      if (typeof branchPattern !== 'string') {
        throw new Error('pr.branch_pattern must be a string');
      }
      // Try to compile the regex to validate it
      try {
        new RegExp(branchPattern);
      } catch {
        throw new Error(`pr.branch_pattern is not a valid regex: ${branchPattern}`);
      }
    }

    // Validate ignore_draft
    const ignoreDraft = pr['ignore_draft'];
    if (ignoreDraft !== undefined && typeof ignoreDraft !== 'boolean') {
      throw new Error('pr.ignore_draft must be a boolean');
    }
  }
}
