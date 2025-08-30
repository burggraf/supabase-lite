import { Command } from 'commander';
import { AdminClient } from '../lib/admin-client.js';
import { UrlParser } from '../lib/url-parser.js';
import { ResultFormatter } from '../lib/result-formatter.js';
import { AutoProxyManager } from '../lib/proxy/auto-proxy-manager.js';
import readline from 'readline/promises';

interface AdminOptions {
  url: string;
}

interface CreateProjectOptions extends AdminOptions {
  projectName: string;
}

interface DeleteProjectOptions extends AdminOptions {
  projectId: string;
  yes?: boolean;
}

/**
 * Helper function to ensure proxy is set up if needed and return the proper URL
 */
async function ensureProxyForUrl(originalUrl: string): Promise<string> {
  const autoProxyManager = AutoProxyManager.getInstance();
  return await autoProxyManager.ensureProxy(originalUrl);
}

export function createAdminCommand(): Command {
  const adminCommand = new Command('admin');
  
  adminCommand
    .description('Administrative commands for managing Supabase Lite projects');

  // Create Project Command
  adminCommand
    .command('create-project <project-name>')
    .description('Create a new project on the Supabase Lite server')
    .requiredOption('-u, --url <url>', 'Supabase Lite URL (e.g., http://localhost:5173)')
    .action(async (projectName: string, options: AdminOptions) => {
      await executeCreateProject({ ...options, projectName });
    });

  // Delete Project Command  
  adminCommand
    .command('delete-project <project-id>')
    .description('Delete an existing project')
    .requiredOption('-u, --url <url>', 'Supabase Lite URL (e.g., http://localhost:5173)')
    .option('-y, --yes', 'Skip confirmation prompt', false)
    .action(async (projectId: string, options: Omit<DeleteProjectOptions, 'projectId'>) => {
      await executeDeleteProject({ ...options, projectId });
    });

  // List Projects Command
  adminCommand
    .command('list-projects')
    .description('List all projects on the Supabase Lite server')
    .requiredOption('-u, --url <url>', 'Supabase Lite URL (e.g., http://localhost:5173)')
    .action(async (options: AdminOptions) => {
      await executeListProjects(options);
    });

  return adminCommand;
}

async function executeCreateProject(options: CreateProjectOptions): Promise<void> {
  try {
    // Validate URL
    const validation = UrlParser.validate(options.url);
    if (!validation.valid) {
      console.error(ResultFormatter.formatGeneralError(`Invalid URL: ${validation.error}`));
      process.exit(1);
    }

    // Validate project name
    const trimmedName = options.projectName.trim();
    if (!trimmedName) {
      console.error(ResultFormatter.formatGeneralError('Project name cannot be empty'));
      process.exit(1);
    }

    if (trimmedName.length < 2) {
      console.error(ResultFormatter.formatGeneralError('Project name must be at least 2 characters long'));
      process.exit(1);
    }

    if (trimmedName.length > 50) {
      console.error(ResultFormatter.formatGeneralError('Project name must be less than 50 characters long'));
      process.exit(1);
    }

    // Check for valid characters (alphanumeric, spaces, hyphens, underscores)
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmedName)) {
      console.error(ResultFormatter.formatGeneralError('Project name can only contain letters, numbers, spaces, hyphens, and underscores'));
      process.exit(1);
    }

    console.log('🚀 Creating project...');

    // Set up proxy if needed for HTTPS URLs
    const effectiveUrl = await ensureProxyForUrl(options.url);
    
    const adminClient = new AdminClient(effectiveUrl);
    const project = await adminClient.createProject(trimmedName);

    console.log(ResultFormatter.formatProjectCreated(project));

    // Send completion signal to browser and then exit for deployed instances
    const autoProxyManager = AutoProxyManager.getInstance();
    if (autoProxyManager.isProxyNeeded(options.url)) {
      // Find the running proxy instance and send completion signal
      const runningProxies = autoProxyManager.getRunningProxies();
      const proxyForUrl = runningProxies.find(p => p.url === options.url);
      
      if (proxyForUrl) {
        try {
          // Send completion signal to browser before shutdown
          await autoProxyManager.sendCompletionSignalAndExit(options.url);
        } catch (error) {
          console.error('Error sending completion signal:', error);
          setTimeout(() => process.exit(0), 1000);
        }
      } else {
        setTimeout(() => process.exit(0), 1000);
      }
    }

  } catch (error) {
    console.error(ResultFormatter.formatGeneralError(
      error instanceof Error ? error.message : 'Failed to create project'
    ));
    
    process.exit(1);
  }
}

async function executeDeleteProject(options: DeleteProjectOptions): Promise<void> {
  try {
    // Validate URL
    const validation = UrlParser.validate(options.url);
    if (!validation.valid) {
      console.error(ResultFormatter.formatGeneralError(`Invalid URL: ${validation.error}`));
      process.exit(1);
    }

    // Validate project ID
    const trimmedId = options.projectId.trim();
    if (!trimmedId) {
      console.error(ResultFormatter.formatGeneralError('Project ID cannot be empty'));
      process.exit(1);
    }

    // Set up proxy if needed for HTTPS URLs
    const effectiveUrl = await ensureProxyForUrl(options.url);
    
    const adminClient = new AdminClient(effectiveUrl);

    // Get project info first to show what will be deleted
    let projectInfo;
    try {
      const projects = await adminClient.listProjects();
      projectInfo = projects.find(p => p.id === trimmedId);
      if (!projectInfo) {
        console.error(ResultFormatter.formatGeneralError(`Project with ID '${trimmedId}' not found`));
        process.exit(1);
      }
    } catch (error) {
      console.error(ResultFormatter.formatGeneralError(
        error instanceof Error ? error.message : 'Failed to fetch project information'
      ));
      process.exit(1);
    }

    // Confirmation prompt unless -y flag is provided
    if (!options.yes) {
      console.log(`⚠️  You are about to delete the following project:`);
      console.log(`   Name: ${projectInfo.name}`);
      console.log(`   ID: ${projectInfo.id}`);
      console.log(`   Created: ${new Date(projectInfo.createdAt).toLocaleString()}`);
      console.log('');
      console.log('⚠️  This action cannot be undone. All data in this project will be permanently lost.');
      console.log('');

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      try {
        const answer = await rl.question('Are you sure you want to delete this project? (y/N): ');
        rl.close();

        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log('❌ Project deletion cancelled');
          process.exit(0);
        }
      } catch (error) {
        rl.close();
        console.error(ResultFormatter.formatGeneralError('Failed to read confirmation'));
        process.exit(1);
      }
    }

    console.log('🗑️  Deleting project...');

    await adminClient.deleteProject(trimmedId);

    console.log(ResultFormatter.formatProjectDeleted(projectInfo));

    // Send completion signal to browser and then exit for deployed instances
    const autoProxyManager = AutoProxyManager.getInstance();
    if (autoProxyManager.isProxyNeeded(options.url)) {
      // Find the running proxy instance and send completion signal
      const runningProxies = autoProxyManager.getRunningProxies();
      const proxyForUrl = runningProxies.find(p => p.url === options.url);
      
      if (proxyForUrl) {
        try {
          // Send completion signal to browser before shutdown
          await autoProxyManager.sendCompletionSignalAndExit(options.url);
        } catch (error) {
          console.error('Error sending completion signal:', error);
          setTimeout(() => process.exit(0), 1000);
        }
      } else {
        setTimeout(() => process.exit(0), 1000);
      }
    }

  } catch (error) {
    console.error(ResultFormatter.formatGeneralError(
      error instanceof Error ? error.message : 'Failed to delete project'
    ));
    
    process.exit(1);
  }
}

async function executeListProjects(options: AdminOptions): Promise<void> {
  try {
    // Validate URL
    const validation = UrlParser.validate(options.url);
    if (!validation.valid) {
      console.error(ResultFormatter.formatGeneralError(`Invalid URL: ${validation.error}`));
      process.exit(1);
    }

    console.log('📋 Fetching projects...');

    // Set up proxy if needed for HTTPS URLs
    const effectiveUrl = await ensureProxyForUrl(options.url);
    
    const adminClient = new AdminClient(effectiveUrl);
    const projects = await adminClient.listProjects();

    console.log(ResultFormatter.formatProjectList(projects));

    // Send completion signal to browser and then exit for deployed instances
    const autoProxyManager = AutoProxyManager.getInstance();
    if (autoProxyManager.isProxyNeeded(options.url)) {
      // Find the running proxy instance and send completion signal
      const runningProxies = autoProxyManager.getRunningProxies();
      const proxyForUrl = runningProxies.find(p => p.url === options.url);
      
      if (proxyForUrl) {
        try {
          // Send completion signal to browser before shutdown
          await autoProxyManager.sendCompletionSignalAndExit(options.url);
        } catch (error) {
          console.error('Error sending completion signal:', error);
          setTimeout(() => process.exit(0), 1000);
        }
      } else {
        setTimeout(() => process.exit(0), 1000);
      }
    }

  } catch (error) {
    console.error(ResultFormatter.formatGeneralError(
      error instanceof Error ? error.message : 'Failed to list projects'
    ));
    
    process.exit(1);
  }
}

export { executeCreateProject, executeDeleteProject, executeListProjects };