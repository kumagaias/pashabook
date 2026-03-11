#!/bin/bash
set -e

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Load environment variables
if [ -f .env.hosting ]; then
  export $(cat .env.hosting | grep -v '^#' | xargs)
else
  echo "Error: .env.hosting file not found"
  echo "Copy .env.hosting.example to .env.hosting and set your credentials"
  exit 1
fi

# Check required variables
if [ -z "$HOSTING_BASIC_AUTH_USERNAME" ] || [ -z "$HOSTING_BASIC_AUTH_PASSWORD" ]; then
  echo "Error: HOSTING_BASIC_AUTH_USERNAME and HOSTING_BASIC_AUTH_PASSWORD must be set in .env.hosting"
  exit 1
fi

# Backup original firebase.json
cp firebase.json firebase.json.backup

# Add basicAuth to firebase.json temporarily
cat firebase.json | jq --arg user "$HOSTING_BASIC_AUTH_USERNAME" --arg pass "$HOSTING_BASIC_AUTH_PASSWORD" \
  '.hosting.basicAuth = {"username": $user, "password": $pass}' > firebase.json.tmp
mv firebase.json.tmp firebase.json

# Deploy
echo "Deploying to Firebase Hosting with Basic Auth..."
firebase deploy --only hosting --project pashabook-dev --non-interactive

# Restore original firebase.json
mv firebase.json.backup firebase.json

echo "✅ Deployed successfully"
