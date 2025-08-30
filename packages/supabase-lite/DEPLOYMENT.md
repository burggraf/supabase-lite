# Supabase Lite CLI - Deployment Guide

This guide explains how to deploy the Supabase Lite CLI to npm for global installation.

## Prerequisites

1. **npm Account**: You need an npm account with publish permissions
2. **npm Login**: Run `npm login` and authenticate
3. **Clean Git State**: Ensure all changes are committed

## Deployment Methods

### Method 1: Automated Deployment Script (Recommended)

Use the comprehensive deployment script with interactive prompts:

```bash
# Navigate to the CLI package
cd packages/supabase-lite

# Run deployment script (patch version by default)
./scripts/deploy.sh

# For minor or major version bumps
./scripts/deploy.sh minor
./scripts/deploy.sh major
```

The script will:
- ✅ Check prerequisites (clean git, npm login)
- 🔨 Build the project
- 🧪 Run all tests
- 📦 Show package contents preview
- 🤔 Ask for confirmation
- 📈 Bump version and publish
- 🏷️ Optionally create git tag

### Method 2: Quick Deployment

For rapid patch deployments:

```bash
cd packages/supabase-lite
./scripts/quick-deploy.sh
```

### Method 3: Manual Deployment

```bash
cd packages/supabase-lite

# Build and test
npm run build
npm test

# Choose your version bump and publish
npm run publish:patch   # 1.0.0 -> 1.0.1
npm run publish:minor   # 1.0.0 -> 1.1.0  
npm run publish:major   # 1.0.0 -> 2.0.0
```

## Version Bump Guidelines

- **Patch** (`1.0.0` → `1.0.1`): Bug fixes, minor improvements
- **Minor** (`1.0.0` → `1.1.0`): New features, backward compatible
- **Major** (`1.0.0` → `2.0.0`): Breaking changes

## Post-Deployment

### 1. Verify Publication
```bash
# Check if package is available
npm view supabase-lite

# Check latest version
npm view supabase-lite version
```

### 2. Test Global Installation
```bash
# Install globally
npm install -g supabase-lite

# Test CLI
supabase-lite --version
supabase-lite --help

# Test basic functionality (requires running Supabase Lite instance)
supabase-lite psql --url http://localhost:5173 --command "SELECT 1"
```

### 3. Update Documentation

After successful deployment:
- Update README.md with new version examples
- Update changelog if maintained
- Notify users of new features/changes

## Package Configuration

The package includes these key configurations for npm:

```json
{
  "name": "supabase-lite",
  "bin": {
    "supabase-lite": "dist/cli.js"
  },
  "files": [
    "dist",
    "README.md", 
    "package.json"
  ],
  "publishConfig": {
    "access": "public"
  }
}
```

## Automated Checks

The `prepublishOnly` script ensures:
- Project builds successfully
- All tests pass
- No broken functionality reaches npm

## Troubleshooting

### Common Issues

**"You do not have permission to publish"**
- Ensure you're logged in: `npm whoami`
- Check package name isn't taken: `npm view supabase-lite`

**"Working directory not clean"**
- Commit or stash changes: `git status`

**Tests failing**
- Fix failing tests before deployment
- Run `npm test` locally

**Build errors**
- Check TypeScript compilation: `npm run build`
- Fix any compilation errors

### Recovery

If a deployment fails midway:

```bash
# Check current version
npm view supabase-lite version

# If version was bumped but publish failed
npm publish

# If you need to revert a version bump
git reset --hard HEAD~1
```

## Security Notes

- Never commit npm tokens or credentials
- Use `npm logout` on shared machines
- Review package contents with `npm pack --dry-run` before publishing
- Monitor npm for unauthorized changes to your package

## Development Workflow

1. Make changes to CLI
2. Run tests: `npm test`
3. Update version appropriately
4. Deploy: `./scripts/deploy.sh [patch|minor|major]`
5. Verify installation and functionality

This ensures a smooth and reliable deployment process for the Supabase Lite CLI! 🚀