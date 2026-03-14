# Environment Variables Deployment Checklist

Quick reference for deploying BGM_STORAGE_PATH and verifying all environment variables.

## Pre-deployment Checklist

- [x] BGM_STORAGE_PATH added to Terraform (Task 28.3)
- [x] All environment variables documented
- [ ] Terraform changes deployed
- [ ] BGM_STORAGE_PATH verified in Cloud Run
- [ ] BGM files uploaded to Cloud Storage

## Deployment Steps

### 1. Deploy Terraform Changes

```bash
cd infra/environments/dev
terraform plan
terraform apply
```

### 2. Verify Deployment

```bash
# Check BGM_STORAGE_PATH
gcloud run services describe pashabook-worker \
  --region=asia-northeast1 \
  --format="value(spec.template.spec.containers[0].env[?(@.name=='BGM_STORAGE_PATH')].value)"

# Expected: gs://pashabook-dev-pashabook-assets/bgm/
```

### 3. Upload BGM Files (After Step 2)

```bash
cd infra
GCP_PROJECT_ID=pashabook-dev ./scripts/upload-bgm.sh
```

## Environment Variables Status

| Variable | Configured | Deployed | Notes |
|----------|-----------|----------|-------|
| GCP_PROJECT_ID | ✅ | ✅ | pashabook-dev |
| GCP_REGION | ✅ | ✅ | asia-northeast1 |
| GCP_LOCATION | ✅ | ✅ | asia-northeast1 |
| VERTEX_AI_LOCATION | ✅ | ✅ | asia-northeast1 |
| STORAGE_BUCKET_UPLOADS | ✅ | ✅ | pashabook-dev-pashabook-uploads |
| STORAGE_BUCKET_VIDEOS | ✅ | ✅ | pashabook-dev-pashabook-videos |
| STORAGE_BUCKET_AUDIO | ✅ | ✅ | pashabook-dev-pashabook-audio |
| STORAGE_BUCKET_IMAGES | ✅ | ✅ | pashabook-dev-pashabook-images |
| TASKS_QUEUE | ✅ | ✅ | dev-processing |
| CLOUD_RUN_SERVICE_URL | ✅ | ✅ | Hardcoded (see notes) |
| BGM_STORAGE_PATH | ✅ | ⏳ | Pending deployment |

## Quick Verification

```bash
# List all environment variables
gcloud run services describe pashabook-worker \
  --region=asia-northeast1 \
  --format="table(spec.template.spec.containers[0].env[].name, spec.template.spec.containers[0].env[].value)"

# Count environment variables (should be 11 after deployment)
gcloud run services describe pashabook-worker \
  --region=asia-northeast1 \
  --format="value(spec.template.spec.containers[0].env[].name)" | wc -l
```

## Notes

- **CLOUD_RUN_SERVICE_URL**: Hardcoded to avoid circular dependency. Update manually if service is recreated.
- **BGM_STORAGE_PATH**: New in Task 28.3, requires Terraform apply to deploy.
- **BGM Files**: Must be uploaded manually after BGM_STORAGE_PATH is deployed.

## Related Documentation

- Full reference: `infra/ENVIRONMENT_VARIABLES.md`
- BGM setup: `infra/BGM_SETUP.md`
- Task summary: `infra/TASK_28.4_SUMMARY.md`
