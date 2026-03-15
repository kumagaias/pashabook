# Cloud Run Environment Variables

Complete reference for all environment variables used by the Pashabook backend service.

## Current Configuration Status

All required environment variables are configured in Terraform (`infra/modules/gcp/pashabook/main.tf`).

## Environment Variables Reference

### Core GCP Configuration

| Variable | Value | Source | Required | Description |
|----------|-------|--------|----------|-------------|
| `GCP_PROJECT_ID` | `var.project_id` | Terraform | ✅ Yes | GCP project identifier |
| `GCP_REGION` | `var.region` | Terraform | ✅ Yes | GCP region (e.g., asia-northeast1) |
| `GCP_LOCATION` | `var.region` | Terraform | ✅ Yes | Alias for GCP_REGION |
| `VERTEX_AI_LOCATION` | `var.region` | Terraform | ✅ Yes | Vertex AI API location |

### Storage Buckets

| Variable | Value | Source | Required | Description |
|----------|-------|--------|----------|-------------|
| `STORAGE_BUCKET_UPLOADS` | `google_storage_bucket.uploads.name` | Terraform | ✅ Yes | User photo uploads |
| `STORAGE_BUCKET_VIDEOS` | `google_storage_bucket.videos.name` | Terraform | ✅ Yes | Generated storybook videos |
| `STORAGE_BUCKET_AUDIO` | `google_storage_bucket.audio.name` | Terraform | ✅ Yes | Generated narration audio |
| `STORAGE_BUCKET_IMAGES` | `google_storage_bucket.images.name` | Terraform | ✅ Yes | Generated illustrations |

### Cloud Tasks

| Variable | Value | Source | Required | Description |
|----------|-------|--------|----------|-------------|
| `TASKS_QUEUE` | `google_cloud_tasks_queue.processing_queue.name` | Terraform | ✅ Yes | Cloud Tasks queue name |

### Service URLs

| Variable | Value | Source | Required | Description |
|----------|-------|--------|----------|-------------|
| `CLOUD_RUN_SERVICE_URL` | Hardcoded URL | Terraform | ✅ Yes | Cloud Run service URL for task callbacks |

**⚠️ Note**: `CLOUD_RUN_SERVICE_URL` is currently hardcoded. Should be updated to use Terraform output.

### BGM Configuration

| Variable | Value | Source | Required | Description |
|----------|-------|--------|----------|-------------|
| `BGM_STORAGE_PATH` | `gs://${google_storage_bucket.assets.name}/bgm/` | Terraform | ✅ Yes | Cloud Storage path for BGM files |

**Added in**: Task 28.3  
**Default**: `gs://pashabook-assets/bgm/`  
**Example**: `gs://pashabook-dev-pashabook-assets/bgm/`

### Runtime Configuration

| Variable | Value | Source | Required | Description |
|----------|-------|--------|----------|-------------|
| `PORT` | `8080` | Cloud Run | No | HTTP server port (auto-set by Cloud Run) |
| `NODE_ENV` | `production` | Not set | No | Node.js environment mode |

## Verification Commands

### Check all environment variables in Cloud Run

```bash
gcloud run services describe pashabook-worker \
  --region=asia-northeast1 \
  --format="value(spec.template.spec.containers[0].env)"
```

### Check specific environment variable

```bash
gcloud run services describe pashabook-worker \
  --region=asia-northeast1 \
  --format="value(spec.template.spec.containers[0].env[?(@.name=='BGM_STORAGE_PATH')].value)"
```

### List all environment variables (formatted)

```bash
gcloud run services describe pashabook-worker \
  --region=asia-northeast1 \
  --format="table(spec.template.spec.containers[0].env[].name, spec.template.spec.containers[0].env[].value)"
```

## Terraform Configuration

Environment variables are defined in `infra/modules/gcp/pashabook/main.tf`:

```terraform
resource "google_cloud_run_service" "worker" {
  # ... other configuration ...
  
  template {
    spec {
      containers {
        # Core GCP
        env { name = "GCP_PROJECT_ID"; value = var.project_id }
        env { name = "GCP_REGION"; value = var.region }
        env { name = "GCP_LOCATION"; value = var.region }
        env { name = "VERTEX_AI_LOCATION"; value = var.region }
        
        # Storage buckets
        env { name = "STORAGE_BUCKET_UPLOADS"; value = google_storage_bucket.uploads.name }
        env { name = "STORAGE_BUCKET_VIDEOS"; value = google_storage_bucket.videos.name }
        env { name = "STORAGE_BUCKET_AUDIO"; value = google_storage_bucket.audio.name }
        env { name = "STORAGE_BUCKET_IMAGES"; value = google_storage_bucket.images.name }
        
        # Cloud Tasks
        env { name = "TASKS_QUEUE"; value = google_cloud_tasks_queue.processing_queue.name }
        
        # Service URLs
        env { name = "CLOUD_RUN_SERVICE_URL"; value = "https://pashabook-worker-147157419642.asia-northeast1.run.app" }
        
        # BGM
        env { name = "BGM_STORAGE_PATH"; value = "gs://${google_storage_bucket.assets.name}/bgm/" }
      }
    }
  }
}
```

## Backend Code Usage

Environment variables are accessed through `backend/src/config/gcp.ts`:

```typescript
export const config = {
  projectId: process.env.GCP_PROJECT_ID || '',
  region: process.env.GCP_REGION || 'us-central1',
  storageBucketUploads: process.env.STORAGE_BUCKET_UPLOADS || '',
  storageBucketVideos: process.env.STORAGE_BUCKET_VIDEOS || '',
  storageBucketAudio: process.env.STORAGE_BUCKET_AUDIO || '',
  storageBucketImages: process.env.STORAGE_BUCKET_IMAGES || '',
  tasksQueue: process.env.TASKS_QUEUE || 'pashabook-processing',
  bgmStoragePath: process.env.BGM_STORAGE_PATH || 'gs://pashabook-assets/bgm/',
  vertexAI: {
    location: process.env.VERTEX_AI_LOCATION || 'us-central1',
  },
};
```

## Known Issues

### 1. Hardcoded CLOUD_RUN_SERVICE_URL

**Issue**: The Cloud Run service URL is hardcoded in Terraform instead of using the output.

**Current**:
```terraform
env {
  name  = "CLOUD_RUN_SERVICE_URL"
  value = "https://pashabook-worker-147157419642.asia-northeast1.run.app"
}
```

**Should be**:
```terraform
env {
  name  = "CLOUD_RUN_SERVICE_URL"
  value = google_cloud_run_service.worker.status[0].url
}
```

**Impact**: Must manually update URL if service is recreated or deployed to different environment.

**Fix**: Update Terraform configuration to use dynamic output (see Recommendations below).

## Recommendations

### 1. Fix CLOUD_RUN_SERVICE_URL

Update `infra/modules/gcp/pashabook/main.tf`:

```terraform
env {
  name  = "CLOUD_RUN_SERVICE_URL"
  value = google_cloud_run_service.worker.status[0].url
}
```

**Note**: This creates a circular dependency (service needs URL, URL comes from service). Consider:
- Using `self_link` instead of `status[0].url`
- Or keeping hardcoded but documenting update process

### 2. Add NODE_ENV

Consider adding explicit `NODE_ENV=production` for production environments:

```terraform
env {
  name  = "NODE_ENV"
  value = var.environment == "prod" ? "production" : "development"
}
```

### 3. Validate Configuration

Add validation in backend startup (`backend/src/index.ts`):

```typescript
import { validateConfig } from './config/gcp';

// Validate configuration on startup
try {
  validateConfig();
  console.log('✅ Configuration validated successfully');
} catch (error) {
  console.error('❌ Configuration validation failed:', error);
  process.exit(1);
}
```

## Deployment Process

### 1. Update Terraform Configuration

```bash
cd infra/environments/dev
terraform plan   # Review changes
terraform apply  # Apply changes
```

### 2. Deploy Backend

```bash
# Option 1: Local deployment
make backend-deploy

# Option 2: GitHub Actions (automatic on push to main)
git push origin main
```

### 3. Verify Environment Variables

```bash
# Check all variables
gcloud run services describe pashabook-worker \
  --region=asia-northeast1 \
  --format="table(spec.template.spec.containers[0].env[].name, spec.template.spec.containers[0].env[].value)"

# Verify BGM_STORAGE_PATH specifically
gcloud run services describe pashabook-worker \
  --region=asia-northeast1 \
  --format="value(spec.template.spec.containers[0].env[?(@.name=='BGM_STORAGE_PATH')].value)"
```

## Related Documentation

- **BGM Setup**: `infra/BGM_SETUP.md`
- **BGM Implementation**: `infra/BGM_IMPLEMENTATION_SUMMARY.md`
- **Deployment Guide**: `infra/deployment-workflow.md`
- **Terraform Module**: `infra/modules/gcp/pashabook/`

## Task References

- **Task 28.3**: Added BGM_STORAGE_PATH to Terraform
- **Task 28.4**: This documentation (environment variable verification)
- **Task 32.1**: VideoCompositor will use BGM_STORAGE_PATH

---

**Last Updated**: 2026-03-12  
**Status**: ✅ All required environment variables configured
