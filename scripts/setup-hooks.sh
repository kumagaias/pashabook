#!/bin/bash
# Setup Git hooks from .githooks directory

set -e

echo "Setting up Git hooks..."

# Copy hooks from .githooks to .git/hooks
if [ -d ".githooks" ]; then
    for hook in .githooks/*; do
        if [ -f "$hook" ]; then
            hook_name=$(basename "$hook")
            echo "Installing $hook_name..."
            cp "$hook" ".git/hooks/$hook_name"
            chmod +x ".git/hooks/$hook_name"
        fi
    done
    echo "✅ Git hooks installed successfully!"
else
    echo "❌ .githooks directory not found"
    exit 1
fi

echo ""
echo "Installed hooks:"
ls -la .git/hooks/ | grep -v "\.sample$" | grep -v "^d" | grep -v "^total"
