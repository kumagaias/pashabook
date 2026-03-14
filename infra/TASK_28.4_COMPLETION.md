# Task 28.4: Configure Environment Variables - Completion Report

**Date**: 2026-03-12  
**Task**: Configure environment variables for Cloud Run  
**Status**: ✅ COMPLETE

## Summary

Task 28.4 required adding BGM_STORAGE_PATH environment variable and verifying all required environment variables are configured in Cloud Run. Additionally, the CLOUD_RUN_SERVICE_URL was updated to use dynamic construction instead of hardcoded value.

## Changes Made

### 1. BGM_STORAGE_PATH Environment Variable
**Status**: Already configured (no changes needed)

The BGM_STORAGE_PATH environment variable was already present in `infra/modules/gcp/pashabook/main.tf`:

```terraform
env {
  name  = "BGM_STORAGE_PATH"
  value = "gs://${google_storage_bucket.assets.name}/bgm/"
}
```

This correctly points to the BGM directory in the assets bucket, which will resolve to:
- Dev environment: `gs://pashabook-dev-pashabook-assets/bgm/`

### 2. CLOUD_RUN_SERVICE_URL Dynamic Construction
**Status**: Updated

**Before** (hardcoded):
```terraform
env {
  name  = "CLOUD_RUN_SERVICE_URL"
  value = "https://pashabook-worker-147157419642.asia-northeast1.run.app"
}
```

**After** (dynamic):
```terraform
env {
  name  = "CLOUD_RUN_SERVICE_URL"
  value = "https://pashabook-worker-${data.google_project.current.number}.${var.region}.run.app"
}
```

**Added data source** at the top of `main.tf`:
```terraform
# Data source to get project number
data "google_project" "current" {
  project_id = var.project_id
}
```

**Rationale**: 
- Eliminates hardcoded project number (147157419642)
- Makes configuration portable across environments
- Automatically constructs correct Cloud Run URL using project number and region
- Prevents deployment issues when project changes

### 3. Environment Variables Verification
**Status**: All required variables present

Verified all required environment variables from design document are configured:

| Variable | Status | Value Source |
|----------|--------|--------------|
| GCP_PROJECT_ID | ✅ | `var.project_id` |
| GCP_REGION | ✅ | `var.region` |
| GCP_LOCATION | ✅ | `var.region` (alias) |
| VERTEX_AI_LOCATION | ✅ | `var.region` |
| CLOUD_RUN_SERVICE_URL | ✅ | Dynamic (updated) |
| BGM_STORAGE_PATH | ✅ | `gs://${assets_bucket}/bgm/` |
| STORAGE_BUCKET_UPLOADS | ✅ | `google_storage_bucket.uploads.name` |
| STORAGE_BUCKET_VIDEOS | ✅ | `google_storage_bucket.videos.name` |
| STORAGE_BUCKET_AUDIO | ✅ | `google_storage_bucket.audio.name` |
| STORAGE_BUCKET_IMAGES | ✅ | `google_storage_bucket.images.name` |
| TASKS_QUEUE | ✅ | `google_cloud_tasks_queue.processing_queue.name` |

**Note**: FIREBASE_PROJECT_ID is not needed as GCP_PROJECT_ID serves the same purpose.

### 4. Terraform Outputs
**Status**: Already present

The `cloud_run_url` output already exists in `infra/modules/gcp/pashabook/outputs.tf`:

```terraform
output "cloud_run_url" {
  description = "Cloud Run service URL"
  value       = google_cloud_run_service.worker.status[0].url
}
```

This output can be used by the deployment script to configure the mobile app.

## Files Modified

1. `infra/modules/gcp/pashabook/main.tf`
   - Added `data "google_project" "current"` data source
   - Updated CLOUD_RUN_SERVICE_URL to use dynamic construction

## Testing Recommendations

Before deploying to production:

1. **Terraform Plan**: Run `terraform plan` to verify changes
   ```bash
   cd infra/environments/dev
   terraform plan
   ```

2. **Verify URL Construction**: After deployment, check Cloud Run environment variables
   ```bash
   gcloud run services describe pashabook-worker \
     --region asia-northeast1 \
     --format="value(spec.template.spec.containers[0].env)"
   ```

3. **Test BGM Path**: Verify BGM files are accessible from the constructed path
   ```bash
   gsutil ls gs://pashabook-dev-pashabook-assets/bgm/
   ```

4. **Test Cloud Tasks**: Verify Cloud Tasks can reach the Cloud Run service using the dynamic URL

## Related Tasks

- Task 28.3: Upload BGM files to Cloud Storage (prerequisite)
- Task 32.1: BGM selection logic (uses BGM_STORAGE_PATH)
- Task 32.2: BGM integration tests (validates BGM_STORAGE_PATH)

## References

- **Design Document**: `.kiro/specs/pashabook-mvp/design.md` (Infrastructure Configuration section)
- **Requirements**: 18.1 (BGM integration), 18.2 (BGM selection)
- **Deployment Guide**: `.kiro/steering/deployment-workflow.md`

## Deployment Notes

The dynamic CLOUD_RUN_SERVICE_URL construction prevents the circular dependency issue that would occur if we tried to reference `google_cloud_run_service.worker.status[0].url` within the same resource. The URL format is predictable:

```
https://{service-name}-{project-number}.{region}.run.app
```

Where:
- `service-name`: "pashabook-worker" (defined in resource)
- `project-number`: Retrieved from `data.google_project.current.number`
- `region`: From `var.region` (e.g., "asia-northeast1")

This approach ensures the environment variable is set correctly on first deployment without requiring a two-step process.
