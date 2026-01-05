/**
 * Setup GitHub Actions command for Issue-to-Project linking
 *
 * This command creates the necessary files to automatically add new Issues
 * to a GitHub Project when they are created.
 *
 * @module
 */

import { ensureDir } from '@std/fs';
import { dirname, fromFileUrl, join } from '@std/path';
import type { Command, CommandContext } from '../types.ts';
import * as colors from '../colors.ts';

/**
 * Get the templates directory path
 */
function getTemplatesDir(): string {
  const currentFile = fromFileUrl(import.meta.url);
  return join(dirname(dirname(currentFile)), 'templates');
}

/**
 * Check if a file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy a template file to the target location
 *
 * @param templateName - Name of the template file
 * @param targetPath - Target file path
 * @param replacements - Optional string replacements to apply
 */
async function copyTemplate(
  templateName: string,
  targetPath: string,
  replacements?: Record<string, string>,
): Promise<void> {
  const templatesDir = getTemplatesDir();
  const templatePath = join(templatesDir, templateName);

  let content = await Deno.readTextFile(templatePath);

  if (replacements) {
    for (const [key, value] of Object.entries(replacements)) {
      content = content.replaceAll(key, value);
    }
  }

  await Deno.writeTextFile(targetPath, content);
}

/**
 * Action handler for the setup-actions command
 */
async function setupActionsAction(ctx: CommandContext): Promise<void> {
  const force = ctx.flags.force as boolean | undefined;
  const projectUrl = ctx.flags['project-url'] as string | undefined;

  console.log(colors.highlight('\n🚀 Setting up GitHub Actions for Issue-to-Project linking\n'));

  const workflowDir = '.github/workflows';
  const workflowPath = join(workflowDir, 'issue-to-project.yml');
  const configPath = '.github/project.toml';

  // Check for existing files
  const workflowExists = await fileExists(workflowPath);
  const configExists = await fileExists(configPath);

  if (!force && (workflowExists || configExists)) {
    const existingFiles: string[] = [];
    if (workflowExists) existingFiles.push(workflowPath);
    if (configExists) existingFiles.push(configPath);

    console.log(colors.warning('⚠️  The following files already exist:'));
    for (const file of existingFiles) {
      console.log(colors.muted(`   - ${file}`));
    }
    console.log(colors.muted('\nUse --force to overwrite existing files.\n'));
    Deno.exit(1);
  }

  // Create directories
  await ensureDir(workflowDir);
  console.log(colors.success(`✓ Created directory: ${workflowDir}`));

  // Copy workflow template
  await copyTemplate('issue-to-project.yml', workflowPath);
  console.log(colors.success(`✓ Created workflow: ${workflowPath}`));

  // Copy and optionally customize config template
  const replacements: Record<string, string> = {};
  if (projectUrl) {
    replacements['https://github.com/users/YOUR_USERNAME/projects/YOUR_PROJECT_NUMBER'] =
      projectUrl;
  }
  await copyTemplate('project.toml', configPath, replacements);
  console.log(colors.success(`✓ Created config: ${configPath}`));

  // Print next steps
  console.log(colors.highlight('\n📋 Next Steps:\n'));

  console.log(colors.header('1. Configure PROJECT_TOKEN secret:'));
  console.log(
    colors.muted('   - Go to your repository Settings > Secrets and variables > Actions'),
  );
  console.log(colors.muted('   - Click "New repository secret"'));
  console.log(colors.muted('   - Name: PROJECT_TOKEN'));
  console.log(colors.muted('   - Value: Your Personal Access Token with "project" scope'));
  console.log();

  if (!projectUrl) {
    console.log(colors.header('2. Edit .github/project.toml:'));
    console.log(colors.muted('   - Update the project URL to your GitHub Project'));
    console.log(colors.muted('   - Customize default field values as needed'));
    console.log();
  }

  console.log(colors.header(`${projectUrl ? '2' : '3'}. Create a test Issue:`));
  console.log(colors.muted('   - Create a new Issue in your repository'));
  console.log(colors.muted('   - Check if it appears in your GitHub Project'));
  console.log();

  console.log(colors.success('✅ Setup complete!\n'));
}

/**
 * Setup-actions command definition
 *
 * Creates GitHub Actions workflow files for automatic Issue-to-Project linking.
 *
 * @example
 * ```bash
 * # Basic setup
 * deno task setup:actions
 *
 * # With project URL pre-configured
 * deno task setup:actions --project-url https://github.com/users/myuser/projects/1
 *
 * # Force overwrite existing files
 * deno task setup:actions --force
 * ```
 */
export const setupActionsCommand: Command = {
  name: 'setup-actions',
  description: 'Setup GitHub Actions for automatic Issue-to-Project linking',
  aliases: ['setup'],
  flags: [
    {
      short: 'f',
      long: 'force',
      description: 'Overwrite existing files',
    },
    {
      short: 'p',
      long: 'project-url',
      description: 'GitHub Project URL to pre-configure',
      takesValue: true,
    },
  ],
  action: setupActionsAction,
};
