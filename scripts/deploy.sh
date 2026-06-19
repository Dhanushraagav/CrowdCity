#!/bin/bash
# CrowdCity Automated Deployment Script
# Safely pulls changes, validates builds, runs integration tests, and restarts the Docker containers.

# Exit immediately if a command exits with a non-zero status
set -e

echo "=========================================================="
echo "🚀 Starting CrowdCity Automated Production Deployment..."
echo "=========================================================="

# 1. Pull latest code (if in a Git repo)
if [ -d ".git" ]; then
  echo "📥 Fetching latest code from repository..."
  git pull origin main
else
  echo "ℹ️  Not a git repository, skipping git pull."
fi

# 2. Run local tests to verify code integrity
echo "🧪 Running integration verification tests..."
if [ -f "scratch/test_prod.js" ]; then
  # Set test env variables
  export NODE_ENV=development
  node scratch/test_prod.js
  echo "✅ Verification tests passed."
else
  echo "⚠️  test_prod.js not found, skipping integration tests."
fi

# 3. Build & Deploy Docker containers
echo "🏗️  Rebuilding and launching production containers..."
docker compose down --remove-orphans
docker compose build --no-cache
docker compose up -d

# 4. Post-Deployment Verification Health Check
echo "🔍 Performing health check validation..."
sleep 3 # Wait for server to boot

HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health || echo "failed")

if [ "$HEALTH_STATUS" -eq 200 ]; then
  echo "=========================================================="
  echo "🎉 DEPLOYMENT SUCCESSFUL! Server is running at http://localhost:5000"
  echo "=========================================================="
else
  echo "=========================================================="
  echo "❌ DEPLOYMENT FAILED! Health check returned status: $HEALTH_STATUS"
  echo "   Retrieving container logs..."
  echo "=========================================================="
  docker compose logs --tail=50
  exit 1
fi
