# Deployment Guide

Quick reference for deploying Pashabook components.

---

## Backend Deployment (Cloud Run)

```bash
cd infra
./scripts/deploy.sh
```

This script:
1. Builds Docker image
2. Pushes to Artifact Registry
3. Deploys to Cloud Run

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

---

**Related:**
- #[[file:react-polling-patterns.md]] - Polling safeguards
