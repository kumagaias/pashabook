# Deployment Guide

Quick reference for deploying Pashabook components.

---

## Backend Deployment (Cloud Run)

### Local deployment
```bash
make backend-deploy    # Build, push, and deploy
```

Manual deployment:
```bash
cd infra
GCP_PROJECT_ID=pashabook-dev ./scripts/deploy.sh
```

### CI/CD deployment (GitHub Actions)
- Push to `main` branch → automatic deployment
- Manual trigger: GitHub Actions > Deploy Backend > Run workflow
- Setup: `infra/GITHUB_ACTIONS_SETUP.md`
- No local Docker build required

This script:
1. Builds Docker image
2. Pushes to Artifact Registry
3. Deploys to Cloud Run
4. Updates environment variables

---

## Web Deployment (Firebase Hosting)

### Local deployment
```bash
make web-deploy        # Build and deploy
make web-preview       # Preview locally (http://localhost:8000)
```

Manual deployment:
```bash
cd mobile
npx expo export --platform web
firebase deploy --only hosting
```

### CI/CD deployment (GitHub Actions)
- Push to `main` branch → automatic deployment
- Manual trigger: GitHub Actions > Deploy Web to Firebase Hosting > Run workflow
- Setup: `infra/GITHUB_ACTIONS_SETUP.md`
- Deploys to: https://pashabook-dev.web.app/

---

## Development Builds

```bash
make dev-build         # Android/iOS development build
make web-build         # Web build only (no deploy)
```

---

## Pre-deployment Checklist

- [ ] All tests pass (`make test`)
- [ ] Rate limiting verified (check Network tab)
- [ ] No infinite polling loops
- [ ] Environment variables configured
- [ ] `CLOUD_RUN_SERVICE_URL` set in Terraform
- [ ] Express `trust proxy` enabled for Cloud Run

---

## Common Issues

### Jobs stuck in "pending" status
- Check `CLOUD_RUN_SERVICE_URL` environment variable is set
- Verify Cloud Tasks queue is running
- Check Cloud Run logs for errors

### Rate limiting errors in Cloud Run
- Ensure Express `trust proxy` is enabled: `app.set('trust proxy', true)`
- Cloud Run uses proxy headers (`X-Forwarded-For`)

### Infinite polling loops
- Verify polling dependencies array has NO state variables
- Check Network tab: should see 1 request per interval (e.g., 2 seconds)
- If multiple requests per second → DO NOT DEPLOY
- See #[[file:react-polling-patterns.md]] for prevention patterns

---

## Recent Fixes (2026-03-11/12)

### Fixed: Cloud Run 500 error
- Added `GCP_REGION=asia-northeast1` environment variable
- Added `VERTEX_AI_LOCATION=asia-northeast1` environment variable
- Fixed Cloud Tasks queue path construction

### Fixed: Infinite polling loop
- Removed state from `pollJobStatus` dependencies
- Added polling safeguards (time limits, terminal state checks)
- Deployed web fix to Firebase Hosting

### Added: Server-side rate limiting
- Implemented `express-rate-limit` middleware
- API endpoints: 100 req/min
- Status polling: 200 req/min (~10 concurrent users)
- Requires `trust proxy` enabled for Cloud Run

### Added: GitHub Actions CI/CD (2026-03-12)
- Backend: Workload Identity Federation (tokenless authentication)
- Backend: Automatic deployment on push to `main` (backend/ changes only)
- Backend: Docker build/push to Artifact Registry in GitHub Actions
- Web: Firebase Hosting deployment with Service Account
- Web: Automatic deployment on push to `main` (mobile/ changes only)
- Setup: `infra/GITHUB_ACTIONS_SETUP.md`

---

**Related:**
- #[[file:react-polling-patterns.md]] - Polling safeguards
