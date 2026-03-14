# Environment Variables Verification Report

**Date**: 2026-03-13
**Task**: 28.4 - Configure environment variables

## Current Status

### Terraform Configuration (Expected)

The following environment variables are defined in `infra/modules/gcp/pashabook/main.tf`:

1. ✅ **GCP_PROJECT_ID** - Project ID
2. ✅ **GCP_REGION** - Region (asia-northeast1)
3. ✅ **GCP_LOCATION** - Location (same as region)
4. ✅ **STORAGE_BUCKET_UPLOADS** - Uploads bucket name
5. ✅ **STORAGE_BUCKET_VIDEOS** - Videos bucket name
6. ✅ **STORAGE_BUCKET_AUDIO** - Audio bucket name
7. ✅ **STORAGE_BUCKET_IMAGES** - Images bucket name
8. ✅ **TASKS_QUEUE** - Cloud Tasks queue name
9. ✅ **VERTEX_AI_LOCATION** - Vertex AI location
10. ✅ **CLOUD_RUN_SERVICE_URL** - Cloud Run service URL
11. ✅ **BGM_STORAGE_PATH** - Background music storage path (gs://bucket/bgm/)

### Deployed Service (Actual)

Current Cloud Run service `pashabook-worker` only has:
- ❌ **BGM_STORAGE_PATH** only

**Issue**: Service was likely deployed manually via `gcloud run deploy` instead of Terraform, causing environment variable drift.

## Required Actions

### Option 1: Apply Terraform Configuration (Recommended)
```bash
cd infra/environments/dev
terraform init
terraform plan  # Review changes
terraform apply # Apply configuration
```

This will:
- Update Cloud Run service with all environment variables
- Ensure infrastructure matches code
- Enable proper infrastructure management

### Option 2: Manual Update (Not Recommended)
Update environment variables manually via gcloud CLI or Console. This creates drift between Terraform and actual infrastructure.

## Terraform Outputs

The following outputs are properly configured:

- ✅ `cloud_run_url` - Exposes Cloud Run service URL
- ✅ `artifact_registry_repository` - Docker repository URL
- ✅ `storage_bucket_*` - All bucket names
- ✅ `tasks_queue_name` - Queue name
- ✅ `service_account_email` - Service account
- ✅ `workload_identity_provider` - GitHub Actions auth
- ✅ `github_actions_service_account_email` - GitHub Actions SA

## Verification Steps

After applying Terraform:

1. Check environment variables:
```bash
gcloud run services describe pashabook-worker \
  --region=asia-northeast1 \
  --format="table(spec.template.spec.containers[0].env)"
```

2. Verify all 11 environment variables are present

3. Test backend functionality:
   - Create a book
   - Verify job processing
   - Check video generation

## Notes

- BGM_STORAGE_PATH format: `gs://{project-id}-pashabook-assets/bgm/`
- CLOUD_RUN_SERVICE_URL format: `https://pashabook-worker-{project-number}.{region}.run.app`
- All environment variables are non-sensitive (no secrets)
- Service account permissions are properly configured via IAM

## Recommendation

**Deploy via Terraform** to ensure:
1. All environment variables are configured
2. Infrastructure as Code is the source of truth
3. Future updates are consistent
4. No manual drift occurs

Command:
```bash
make backend-deploy
```

Or manually:
```bash
cd infra
GCP_PROJECT_ID=pashabook-dev ./scripts/deploy.sh
```
