#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createPsqlCommand } from './commands/psql.js';
import { createAdminCommand } from './commands/admin.js';
import { createProxyCommand } from './commands/proxy.js';

// Get package.json to read version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

const program = new Command();

program
  .name('supabase-lite')
  .description('Command-line interface for Supabase Lite - browser-based PostgreSQL database')
  .version(packageJson.version);

// Add commands
program.addCommand(createPsqlCommand());
program.addCommand(createAdminCommand());
program.addCommand(createProxyCommand());

// Future commands can be added here:
// program.addCommand(createDbCommand());
// program.addCommand(createFunctionsCommand());
// program.addCommand(createStorageCommand());
// program.addCommand(createAuthCommand());
// program.addCommand(createMigrationsCommand());

// Handle unknown commands
program.on('command:*', (operands) => {
  const unknownCommand = operands[0];
  console.error(`❌ Unknown command '${unknownCommand}'.`);
  console.error('');
  console.error('Available commands:');
  console.error('  psql     Connect to database (psql-compatible interface)');
  console.error('  admin    Administrative commands for managing projects');
  console.error('  proxy    Manage proxy servers for Supabase Lite instances');
  console.error('');
  console.error('Use --help with any command for more information.');
  process.exit(1);
});

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  console.log('🚀 Supabase Lite CLI');
  console.log('');
  console.log('A command-line interface for Supabase Lite - browser-based PostgreSQL database.');
  console.log('');
  console.log('Usage:');
  console.log('  supabase-lite <command> [options]');
  console.log('');
  console.log('Available commands:');
  console.log('  psql     Connect to database with psql-compatible interface');
  console.log('  admin    Administrative commands for managing projects');
  console.log('  proxy    Manage proxy servers for Supabase Lite instances');
  console.log('');
  console.log('Examples:');
  console.log('  supabase-lite psql --url http://localhost:5173');
  console.log('  supabase-lite admin list-projects --url http://localhost:5173');
  console.log('  supabase-lite admin create-project my-project --url http://localhost:5173');
  console.log('  supabase-lite proxy start --target https://supabase-lite.pages.dev');
  console.log('');
  console.log('Options:');
  console.log('  -V, --version    Show version number');
  console.log('  -h, --help       Show help information');
  console.log('');
  console.log('Get started:');
  console.log('  supabase-lite psql --help');
}