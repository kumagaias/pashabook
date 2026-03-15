# Task 28.4: Configure Environment Variables - Summary

## Task Completion Status

✅ **COMPLETED** - All environment variables verified and documented.

## What Was Done

### 1. Environment Variables Verification

Verified all environment variables in Terraform configuration (`infra/modules/gcp/pashabook/main.tf`):

**✅ Currently Configured (10 variables)**:
- `GCP_PROJECT_ID` - Project identifier
- `GCP_REGION` - Region (asia-northeast1)
- `GCP_LOCATION` - Location alias
- `VERTEX_AI_LOCATION` - Vertex AI location
- `STORAGE_BUCKET_UPLOADS` - User uploads bucket
- `STORAGE_BUCKET_VIDEOS` - Generated videos bucket
- `STORAGE_BUCKET_AUDIO` - Generated audio bucket
- `STORAGE_BUCKET_IMAGES` - Generated images bucket
- `TASKS_QUEUE` - Cloud Tasks queue name
- `CLOUD_RUN_SERVICE_URL` - Service URL (hardcoded)

**✅ Added in Task 28.3**:
- `BGM_STORAGE_PATH` - BGM files location (gs://pashabook-dev-pashabook-assets/bgm/)

### 2. Documentation Created

Created comprehensive documentation:

**`infra/ENVIRONMENT_VARIABLES.md`** (5.8 KB):
- Complete reference for all environment variables
- Verification commands
- Terraform configuration examples
- Backend code usage
- Known issues and recommendations
- Deployment process

**`infra/TASK_28.4_SUMMARY.md`** (This file):
- Task completion summary
- Deployment status
- Next steps

### 3. Current Deployment Status

**Cloud Run Service**: `pashabook-worker` (asia-northeast1)

**Deployed Environment Variables** (10/11):
```
✅ GCP_PROJECT_ID=pashabook-dev
✅ GCP_REGION=asia-northeast1
✅ GCP_LOCATION=asia-northeast1
✅ VERTEX_AI_LOCATION=asia-northeast1
✅ STORAGE_BUCKET_UPLOADS=pashabook-dev-pashabook-uploads
✅ STORAGE_BUCKET_VIDEOS=pashabook-dev-pashabook-videos
✅ STORAGE_BUCKET_AUDIO=pashabook-dev-pashabook-audio
✅ STORAGE_BUCKET_IMAGES=pashabook-dev-pashabook-images
✅ TASKS_QUEUE=dev-processing
✅ CLOUD_RUN_SERVICE_URL=https://pashabook-worker-147157419642.asia-northeast1.run.app
⏳ BGM_STORAGE_PATH=<not yet deployed>
```

**Note**: BGM_STORAGE_PATH is configured in Terraform but not yet deployed to Cloud Run.

## Terraform Outputs Verification

**Current Outputs** (`infra/modules/gcp/pashabook/outputs.tf`):

✅ All required outputs are configured:
- `cloud_run_url` - Cloud Run service URL
- `artifact_registry_repository` - Docker registry URL
- `storage_bucket_*` - All storage bucket names
- `tasks_queue_name` - Cloud Tasks queue name
- `service_account_email` - Backend service account
- `workload_identity_provider` - GitHub Actions auth
- `github_actions_service_account_email` - GitHub Actions SA
- `firebase_service_account_key` - Firebase deployer key (sensitive)

## Known Issues

### 1. Hardcoded CLOUD_RUN_SERVICE_URL

**Issue**: Service URL is hardcoded instead of using Terraform output.

**Current**:
```terraform
env {
  name  = "CLOUD_RUN_SERVICE_URL"
  value = "https://pashabook-worker-147157419642.asia-northeast1.run.app"
}
```

**Why**: Using `google_cloud_run_service.worker.status[0].url` creates a circular dependency (service needs URL for Cloud Tasks, but URL comes from service).

**Impact**: Must manually update if service is recreated or deployed to different environment.

**Recommendation**: Keep hardcoded but document update process, or use a two-step deployment:
1. Deploy service without CLOUD_RUN_SERVICE_URL
2. Update with actual URL after deployment

### 2. BGM_STORAGE_PATH Not Yet Deployed

**Status**: Configured in Terraform but not deployed to Cloud Run.

**Action Required**: Deploy Terraform changes to apply BGM_STORAGE_PATH.

## Next Steps

### Step 1: Deploy Terraform Changes

```bash
cd infra/environments/dev
terraform plan   # Review changes
terraform apply  # Apply BGM_STORAGE_PATH
```

**Expected Change**:
```diff
+ env {
+   name  = "BGM_STORAGE_PATH"
+   value = "gs://pashabook-dev-pashabook-assets/bgm/"
+ }
```

### Step 2: Deploy Backend (Optional)

If Terraform apply doesn't trigger Cloud Run update:

```bash
# Option 1: Local deployment
make backend-deploy

# Option 2: GitHub Actions
git push origin main
```

### Step 3: Verify BGM_STORAGE_PATH

```bash
gcloud run services describe pashabook-worker \
  --region=asia-northeast1 \
  --format="value(spec.template.spec.containers[0].env[?(@.name=='BGM_STORAGE_PATH')].value)"

# Expected output:
# gs://pashabook-dev-pashabook-assets/bgm/
```

### Step 4: Upload BGM Files (Manual)

After BGM_STORAGE_PATH is deployed, upload BGM files:

```bash
cd infra
GCP_PROJECT_ID=pashabook-dev ./scripts/upload-bgm.sh
```

See `infra/BGM_SETUP.md` for detailed instructions.

## Verification Commands

### Check all environment variables

```bash
gcloud run services describe pashabook-worker \
  --region=asia-northeast1 \
  --format="table(spec.template.spec.containers[0].env[].name, spec.template.spec.containers[0].env[].value)"
```

### Check specific variable

```bash
# BGM_STORAGE_PATH
gcloud run services describe pashabook-worker \
  --region=asia-northeast1 \
  --format="value(spec.template.spec.containers[0].env[?(@.name=='BGM_STORAGE_PATH')].value)"

# CLOUD_RUN_SERVICE_URL
gcloud run services describe pashabook-worker \
  --region=asia-northeast1 \
  --format="value(spec.template.spec.containers[0].env[?(@.name=='CLOUD_RUN_SERVICE_URL')].value)"
```

### List Terraform outputs

```bash
cd infra/environments/dev
terraform output
```

## Files Created/Modified

### Created Files (2)
1. `infra/ENVIRONMENT_VARIABLES.md` - Complete environment variables reference
2. `infra/TASK_28.4_SUMMARY.md` - This file

### Modified Files (0)
- No modifications needed (BGM_STORAGE_PATH already added in Task 28.3)

## Task Dependencies

**Depends on**:
- ✅ Task 28.3 - BGM infrastructure setup (completed)

**Required by**:
- Task 32.1 - VideoCompositor BGM selection (needs BGM_STORAGE_PATH)
- Task 32.2 - BGM integration tests (needs BGM_STORAGE_PATH)

## Related Documentation

- **Environment Variables**: `infra/ENVIRONMENT_VARIABLES.md`
- **BGM Setup**: `infra/BGM_SETUP.md`
- **BGM Implementation**: `infra/BGM_IMPLEMENTATION_SUMMARY.md`
- **Deployment Guide**: `.kiro/steering/deployment-workflow.md`
- **Terraform Module**: `infra/modules/gcp/pashabook/`

## Summary

Task 28.4 is complete. All environment variables are:
- ✅ Configured in Terraform
- ✅ Documented comprehensively
- ✅ Verified against backend code requirements
- ⏳ Ready for deployment (BGM_STORAGE_PATH pending)

**Action Required**: Deploy Terraform changes to apply BGM_STORAGE_PATH to Cloud Run.

---

**Task**: 28.4  
**Status**: ✅ Completed  
**Date**: 2026-03-12  
**Requirements**: 18.1, 18.2  
**Design**: Infrastructure Configuration section
