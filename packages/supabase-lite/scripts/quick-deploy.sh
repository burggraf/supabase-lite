#!/bin/bash

# Quick Deployment Script for Supabase Lite CLI
# Usage: ./scripts/quick-deploy.sh

set -e

echo "🚀 Quick deployment of supabase-lite CLI..."

# Build and test
echo "🔨 Building..."
npm run build

echo "🧪 Testing..."
npm test

# Deploy with patch version
echo "📦 Publishing patch version..."
npm run publish:patch

echo "✅ Deployment complete!"
echo "Install with: npm install -g supabase-lite"