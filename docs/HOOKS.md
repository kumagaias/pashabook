# Git Hooks Configuration

This document describes the Git hooks configured for this project.

## Pre-commit Hook

Location: `.git/hooks/pre-commit` (installed from `.githooks/pre-commit`)

The pre-commit hook runs automatically before every commit and performs:

1. **Unit Tests** - Runs `make test-unit` to ensure all tests pass
2. **Security Scan** - Runs `gitleaks protect --staged --verbose` to detect secrets

If either check fails, the commit is blocked.

## Setup

### Initial Setup (First Time)

After cloning the repository, run the setup script to install hooks:

```bash
./scripts/setup-hooks.sh
```

This will copy all hooks from `.githooks/` to `.git/hooks/` and make them executable.

### Manual Setup (Alternative)

If you prefer to set up manually:

```bash
cp .githooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## Requirements

- **gitleaks**: Install with `brew install gitleaks` (macOS)
- **make**: Standard build tool (pre-installed on macOS)

## Hook Management

### Why `.githooks/` instead of `.git/hooks/`?

Git doesn't track files in `.git/hooks/` by design. To share hooks across the team:

1. Store hooks in `.githooks/` (version controlled)
2. Use `scripts/setup-hooks.sh` to install them to `.git/hooks/`
3. Each developer runs the setup script after cloning

### Adding New Hooks

1. Create the hook file in `.githooks/` (e.g., `.githooks/pre-push`)
2. Make it executable: `chmod +x .githooks/pre-push`
3. Commit the hook file
4. Run `./scripts/setup-hooks.sh` to install it

### Updating Existing Hooks

1. Edit the hook file in `.githooks/`
2. Commit your changes
3. Run `./scripts/setup-hooks.sh` to update the installed hook

## Benefits

- Prevents committing broken code
- Catches secrets before they enter version control
- Maintains code quality automatically
- Fast feedback loop for developers
- Hooks are version controlled and shared across the team
