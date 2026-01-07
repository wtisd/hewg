/**
 * GitHub Project API module
 *
 * Provides utilities for interacting with GitHub Projects V2 via GraphQL API.
 * Used by link-issue and pr-status commands.
 *
 * @module
 */

import { type ParsedProjectUrl, parseProjectUrl } from '../types/project-config.ts';

/**
 * Project field type enumeration
 */
export type ProjectFieldType =
  | 'SINGLE_SELECT'
  | 'ITERATION'
  | 'NUMBER'
  | 'DATE'
  | 'TEXT'
  | 'ASSIGNEES'
  | 'LABELS'
  | 'MILESTONE'
  | 'REPOSITORY'
  | 'LINKED_PULL_REQUESTS'
  | 'REVIEWERS'
  | 'TRACKS'
  | 'TRACKED_BY';

/**
 * Single select option for project fields
 */
export interface FieldOption {
  id: string;
  name: string;
}

/**
 * Iteration option for project fields
 */
export interface IterationOption {
  id: string;
  title: string;
  startDate?: string;
  duration?: number;
}

/**
 * Project field information
 */
export interface ProjectField {
  id: string;
  name: string;
  type?: ProjectFieldType;
  options?: FieldOption[];
  iterations?: IterationOption[];
}

/**
 * GitHub Project information
 */
export interface Project {
  id: string;
  title: string;
  fields: ProjectField[];
}

/**
 * Project item (issue or PR in project)
 */
export interface ProjectItem {
  id: string;
  contentId?: string;
  issueNumber?: number;
}

/**
 * Parameters for updating a project field value
 */
export interface UpdateFieldParams {
  projectId: string;
  itemId: string;
  fieldId: string;
  value: FieldValue;
}

/**
 * Field value types for updating project fields
 */
export type FieldValue =
  | { singleSelectOptionId: string }
  | { iterationId: string }
  | { number: number }
  | { date: string }
  | { text: string };

/**
 * GraphQL error response
 */
interface GraphQLError {
  message: string;
  type?: string;
  path?: string[];
}

/**
 * GraphQL response wrapper
 */
interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

/**
 * Execute a GraphQL query against the GitHub API
 *
 * @param query - GraphQL query string
 * @param variables - Query variables
 * @param token - GitHub token for authentication
 * @returns Query result
 * @throws {Error} If the request fails or returns errors
 */
async function executeGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
  token: string,
): Promise<T> {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'hewg-cli',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
  }

  const result = (await response.json()) as GraphQLResponse<T>;

  if (result.errors && result.errors.length > 0) {
    const errorMessages = result.errors.map((e) => e.message).join(', ');
    throw new Error(`GraphQL errors: ${errorMessages}`);
  }

  if (!result.data) {
    throw new Error('No data returned from GraphQL query');
  }

  return result.data;
}

/**
 * Get GitHub token from environment variable
 *
 * @returns GitHub token
 * @throws {Error} If PROJECT_TOKEN is not set
 */
export function getGitHubToken(): string {
  const token = Deno.env.get('PROJECT_TOKEN');
  if (!token) {
    throw new Error(
      'PROJECT_TOKEN environment variable is not set. ' +
        'Please set it with a GitHub token that has project scope.',
    );
  }
  return token;
}

/**
 * Get project information via GraphQL
 *
 * @param projectUrl - GitHub Project URL
 * @param token - GitHub token
 * @returns Project information with fields
 */
export async function getProject(projectUrl: string, token: string): Promise<Project> {
  const projectInfo = parseProjectUrl(projectUrl);

  // Common field fragments for all project field types
  const fieldFragments = `
    ... on ProjectV2Field {
      id
      name
      dataType
    }
    ... on ProjectV2SingleSelectField {
      id
      name
      dataType
      options {
        id
        name
      }
    }
    ... on ProjectV2IterationField {
      id
      name
      dataType
      configuration {
        iterations {
          id
          title
          startDate
          duration
        }
      }
    }
  `;

  const query = projectInfo.isOrg
    ? `
      query($owner: String!, $number: Int!) {
        organization(login: $owner) {
          projectV2(number: $number) {
            id
            title
            fields(first: 50) {
              nodes {
                ${fieldFragments}
              }
            }
          }
        }
      }
    `
    : `
      query($owner: String!, $number: Int!) {
        user(login: $owner) {
          projectV2(number: $number) {
            id
            title
            fields(first: 50) {
              nodes {
                ${fieldFragments}
              }
            }
          }
        }
      }
    `;

  interface FieldNode {
    id: string;
    name: string;
    dataType?: ProjectFieldType;
    options?: Array<{ id: string; name: string }>;
    configuration?: {
      iterations: Array<{ id: string; title: string; startDate?: string; duration?: number }>;
    };
  }

  interface ProjectQueryResult {
    organization?: {
      projectV2: {
        id: string;
        title: string;
        fields: {
          nodes: FieldNode[];
        };
      };
    };
    user?: {
      projectV2: {
        id: string;
        title: string;
        fields: {
          nodes: FieldNode[];
        };
      };
    };
  }

  const result = await executeGraphQL<ProjectQueryResult>(
    query,
    { owner: projectInfo.owner, number: projectInfo.number },
    token,
  );

  const projectData = projectInfo.isOrg ? result.organization?.projectV2 : result.user?.projectV2;

  if (!projectData) {
    throw new Error(`Project not found: ${projectUrl}`);
  }

  // Transform fields to our format
  const fields: ProjectField[] = projectData.fields.nodes
    .filter((f) => f.id && f.name)
    .map((f) => ({
      id: f.id,
      name: f.name,
      type: f.dataType,
      options: f.options,
      iterations: f.configuration?.iterations,
    }));

  return {
    id: projectData.id,
    title: projectData.title,
    fields,
  };
}

/**
 * Get issue node ID from issue number
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param issueNumber - Issue number
 * @param token - GitHub token
 * @returns Issue node ID
 */
export async function getIssueNodeId(
  owner: string,
  repo: string,
  issueNumber: number,
  token: string,
): Promise<string> {
  const query = `
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          id
        }
      }
    }
  `;

  interface IssueQueryResult {
    repository: {
      issue: {
        id: string;
      } | null;
    };
  }

  const result = await executeGraphQL<IssueQueryResult>(
    query,
    { owner, repo, number: issueNumber },
    token,
  );

  if (!result.repository.issue) {
    throw new Error(`Issue #${issueNumber} not found in ${owner}/${repo}`);
  }

  return result.repository.issue.id;
}

/**
 * Add an issue to a project
 *
 * @param projectId - Project ID
 * @param issueNodeId - Issue node ID
 * @param token - GitHub token
 * @returns Created project item ID
 */
export async function addIssueToProject(
  projectId: string,
  issueNodeId: string,
  token: string,
): Promise<string> {
  const mutation = `
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
        item {
          id
        }
      }
    }
  `;

  interface AddItemResult {
    addProjectV2ItemById: {
      item: {
        id: string;
      };
    };
  }

  const result = await executeGraphQL<AddItemResult>(
    mutation,
    { projectId, contentId: issueNodeId },
    token,
  );

  return result.addProjectV2ItemById.item.id;
}

/**
 * Update a project item field value
 *
 * @param params - Update parameters
 * @param token - GitHub token
 */
export async function updateItemField(params: UpdateFieldParams, token: string): Promise<void> {
  const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
      updateProjectV2ItemFieldValue(
        input: {projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value}
      ) {
        projectV2Item {
          id
        }
      }
    }
  `;

  await executeGraphQL(
    mutation,
    {
      projectId: params.projectId,
      itemId: params.itemId,
      fieldId: params.fieldId,
      value: params.value,
    },
    token,
  );
}

/**
 * Get all project items (issues) from a project
 *
 * @param projectId - Project ID
 * @param token - GitHub token
 * @returns List of project items with issue numbers
 */
export async function getProjectItems(projectId: string, token: string): Promise<ProjectItem[]> {
  const query = `
    query($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue {
                  id
                  number
                }
              }
            }
          }
        }
      }
    }
  `;

  interface ItemsQueryResult {
    node: {
      items: {
        nodes: Array<{
          id: string;
          content: {
            id?: string;
            number?: number;
          } | null;
        }>;
      };
    };
  }

  const result = await executeGraphQL<ItemsQueryResult>(query, { projectId }, token);

  return result.node.items.nodes
    .filter((item) => item.content?.number !== undefined)
    .map((item) => ({
      id: item.id,
      contentId: item.content?.id,
      issueNumber: item.content?.number,
    }));
}

/**
 * Find a field by name (case-insensitive)
 *
 * @param fields - List of project fields
 * @param name - Field name to find
 * @returns Field or undefined
 */
export function findField(fields: ProjectField[], name: string): ProjectField | undefined {
  return fields.find((f) => f.name.toLowerCase() === name.toLowerCase());
}

/**
 * Find an option by name in a single-select field (case-insensitive)
 *
 * @param field - Project field with options
 * @param name - Option name to find
 * @returns Option or undefined
 */
export function findOption(field: ProjectField, name: string): FieldOption | undefined {
  return field.options?.find((o) => o.name.toLowerCase() === name.toLowerCase());
}

/**
 * Find an iteration by title (case-insensitive)
 *
 * @param field - Project field with iterations
 * @param title - Iteration title to find
 * @returns Iteration or undefined
 */
export function findIteration(field: ProjectField, title: string): IterationOption | undefined {
  return field.iterations?.find((i) => i.title.toLowerCase() === title.toLowerCase());
}

/**
 * Calculate the end date of an iteration
 *
 * @param iteration - Iteration with startDate and duration
 * @returns End date as Date object, or undefined if missing data
 */
function calculateIterationEndDate(iteration: IterationOption): Date | undefined {
  if (!iteration.startDate || iteration.duration === undefined) {
    return undefined;
  }
  const startDate = new Date(iteration.startDate);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + iteration.duration);
  return endDate;
}

/**
 * Get the current iteration based on today's date
 *
 * Finds the iteration where today falls within the startDate to endDate range.
 * If no current iteration is found, falls back to the closest iteration
 * (next upcoming or most recent past).
 *
 * @param field - Project field with iterations
 * @param referenceDate - Date to use for comparison (defaults to today)
 * @returns Current or closest iteration, or undefined if no iterations exist
 *
 * @example
 * ```ts
 * const iterationField = findField(project.fields, 'Iteration');
 * const currentIteration = getCurrentIteration(iterationField);
 * if (currentIteration) {
 *   console.log(`Current sprint: ${currentIteration.title}`);
 * }
 * ```
 */
export function getCurrentIteration(
  field: ProjectField,
  referenceDate: Date = new Date(),
): IterationOption | undefined {
  const iterations = field.iterations;
  if (!iterations || iterations.length === 0) {
    return undefined;
  }

  // Filter iterations with valid date info
  const iterationsWithDates = iterations.filter(
    (i) => i.startDate && i.duration !== undefined,
  );

  if (iterationsWithDates.length === 0) {
    // No iterations with date info, return the first one as fallback
    return iterations[0];
  }

  // Normalize reference date to start of day for consistent comparison
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  // Find iteration where today is within the date range
  for (const iteration of iterationsWithDates) {
    const startDate = new Date(iteration.startDate!);
    startDate.setHours(0, 0, 0, 0);
    const endDate = calculateIterationEndDate(iteration)!;
    endDate.setHours(0, 0, 0, 0);

    if (today >= startDate && today <= endDate) {
      return iteration;
    }
  }

  // No current iteration found, find the closest one
  let closestIteration: IterationOption | undefined;
  let smallestDiff = Infinity;

  for (const iteration of iterationsWithDates) {
    const startDate = new Date(iteration.startDate!);
    startDate.setHours(0, 0, 0, 0);
    const endDate = calculateIterationEndDate(iteration)!;
    endDate.setHours(0, 0, 0, 0);

    // Calculate distance to this iteration
    let diff: number;
    if (today < startDate) {
      // Future iteration - distance to start
      diff = startDate.getTime() - today.getTime();
    } else {
      // Past iteration - distance from end
      diff = today.getTime() - endDate.getTime();
    }

    if (diff < smallestDiff) {
      smallestDiff = diff;
      closestIteration = iteration;
    }
  }

  return closestIteration;
}

// Re-export parseProjectUrl for convenience
export { type ParsedProjectUrl, parseProjectUrl };
