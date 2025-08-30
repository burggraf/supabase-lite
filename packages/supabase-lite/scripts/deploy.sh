#!/bin/bash

# Supabase Lite CLI Deployment Script
# Usage: ./scripts/deploy.sh [patch|minor|major]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default version type
VERSION_TYPE=${1:-patch}

echo -e "${BLUE}🚀 Supabase Lite CLI Deployment Script${NC}"
echo -e "${BLUE}======================================${NC}"

# Validate version type
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo -e "${RED}❌ Error: Invalid version type '$VERSION_TYPE'. Use: patch, minor, or major${NC}"
    exit 1
fi

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    echo -e "${RED}❌ Error: package.json not found. Run this script from the packages/supabase-lite directory.${NC}"
    exit 1
fi

# Check if we're logged in to npm
if ! npm whoami > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Not logged in to npm. Run 'npm login' first.${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Pre-deployment checks...${NC}"

# Check git status
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${RED}❌ Error: Working directory is not clean. Commit or stash changes first.${NC}"
    git status
    exit 1
fi

echo -e "${GREEN}✅ Working directory is clean${NC}"

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${BLUE}📦 Current version: ${CURRENT_VERSION}${NC}"

# Build the project
echo -e "${YELLOW}🔨 Building project...${NC}"
npm run build

# Run tests
echo -e "${YELLOW}🧪 Running tests...${NC}"
npm test

echo -e "${GREEN}✅ All tests passed${NC}"

# Check package contents
echo -e "${YELLOW}📁 Checking package contents...${NC}"
npm pack --dry-run

# Confirm deployment
echo -e "${BLUE}🤔 Ready to deploy with version bump: ${VERSION_TYPE}${NC}"
echo -e "${BLUE}   This will create a new ${VERSION_TYPE} version and publish to npm.${NC}"
echo -e "${YELLOW}   Continue? (y/N)${NC}"
read -r response

if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⏹️  Deployment cancelled${NC}"
    exit 0
fi

# Version bump and publish
echo -e "${YELLOW}📈 Bumping version and publishing...${NC}"

# Use the npm script that combines version bump and publish
npm run "publish:${VERSION_TYPE}"

# Get new version
NEW_VERSION=$(node -p "require('./package.json').version")

echo -e "${GREEN}🎉 Successfully deployed supabase-lite@${NEW_VERSION}${NC}"
echo -e "${GREEN}📋 Installation command: npm install -g supabase-lite@${NEW_VERSION}${NC}"

# Show package info
echo -e "${BLUE}📊 Package info:${NC}"
npm view supabase-lite dist-tags version

# Optional: Create git tag
echo -e "${YELLOW}🏷️  Create git tag for this release? (y/N)${NC}"
read -r tag_response

if [[ "$tag_response" =~ ^[Yy]$ ]]; then
    git tag "v${NEW_VERSION}"
    git push origin "v${NEW_VERSION}"
    echo -e "${GREEN}✅ Created and pushed git tag v${NEW_VERSION}${NC}"
fi

echo -e "${GREEN}🚀 Deployment complete!${NC}"
echo -e "${BLUE}Next steps:${NC}"
echo -e "  • Test installation: ${YELLOW}npm install -g supabase-lite@${NEW_VERSION}${NC}"
echo -e "  • Verify CLI works: ${YELLOW}supabase-lite --version${NC}"
echo -e "  • Update documentation if needed"