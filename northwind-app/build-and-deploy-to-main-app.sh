#!/bin/bash

# Build and deploy northwind-app to main Supabase Lite app
# This script builds the test-app and copies it to the main app's public directory

echo "🏗️  Building test-app..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "🧹 Cleaning previous deployment..."
rm -rf ../public/apps/northwind/*

echo "📦 Deploying to main app..."
cp -r dist/* ../public/apps/northwind/

if [ $? -eq 0 ]; then
    echo "✅ Successfully deployed test-app to main Supabase Lite app!"
    echo "🌐 Access at: http://localhost:5173/app/northwind"
else
    echo "❌ Deployment failed!"
    exit 1
fi
