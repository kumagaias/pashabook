# Git Hooks Configuration

This document describes the Git hooks configured for this project.

## Pre-commit Hook

Location: `.git/hooks/pre-commit`

The pre-commit hook runs automatically before every commit and performs:

1. **Unit Tests** - Runs `make test-unit` to ensure all tests pass
2. **Security Scan** - Runs `gitleaks protect --staged --verbose` to detect secrets

If either check fails, the commit is blocked.

### Setup

The pre-commit hook is already configured. If you need to recreate it:

```bash
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
# Pre-commit hook: Run unit tests and security checks before commit

echo "Running unit tests..."
make test-unit

if [ $? -ne 0 ]; then
    echo "❌ Unit tests failed. Commit blocked."
    exit 1
fi

echo "✅ Unit tests passed."

echo "Running gitleaks security scan..."
gitleaks protect --staged --verbose

if [ $? -ne 0 ]; then
    echo "❌ Gitleaks found secrets. Commit blocked."
    exit 1
fi

echo "✅ Security scan passed."
exit 0
EOF

chmod +x .git/hooks/pre-commit
```

### Requirements

- **gitleaks**: Install with `brew install gitleaks` (macOS)
- **make**: Standard build tool (pre-installed on macOS)

## Benefits

- Prevents committing broken code
- Catches secrets before they enter version control
- Maintains code quality automatically
- Fast feedback loop for developers
