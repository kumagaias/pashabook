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
- Manual trigger: Actions > Deploy Backend > Run workflow
- Setup: See `infra/GITHUB_ACTIONS_SETUP.md`

This script:
1. Builds Docker image
2. Pushes to Artifact Registry
3. Deploys to Cloud Run
4. Updates environment variables

---

## Web Deployment (Firebase Hosting)

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

## Recent Fixes (2026-03-11)

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

---

**Related:**
- #[[file:react-polling-patterns.md]] - Polling safeguards
