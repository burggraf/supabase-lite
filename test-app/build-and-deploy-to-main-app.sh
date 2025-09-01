#!/bin/bash

# Build and deploy test-app to main Supabase Lite app
# This script builds the test-app and copies it to the main app's public directory

echo "🏗️  Building test-app..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "🧹 Cleaning previous deployment..."
rm -rf ../public/apps/test-app/*

echo "📦 Deploying to main app..."
cp -r dist/* ../public/apps/test-app/

if [ $? -eq 0 ]; then
    echo "✅ Successfully deployed test-app to main Supabase Lite app!"
    echo "🌐 Access at: http://localhost:5173/app/test-app"
else
    echo "❌ Deployment failed!"
    exit 1
fi