# Cloud Run CPU Boost Verification

## Configuration

CPU boost has been enabled for the Cloud Run service to improve cold start performance and video processing speed.

**Location**: `infra/modules/gcp/pashabook/main.tf`

**Annotation**: `run.googleapis.com/cpu-boost: "true"`

## Expected Benefits

- **Cold Start**: 30-50% faster instance startup
- **Video Processing**: Improved FFmpeg performance during composition
- **Overall**: Better response times for compute-intensive operations

## Verification Steps

After deployment, verify CPU boost is enabled:

```bash
# Get service details
gcloud run services describe pashabook-worker \
  --region=asia-northeast1 \
  --format="value(metadata.annotations)"

# Should include: run.googleapis.com/cpu-boost: true
```

## Performance Testing

To measure the improvement:

1. **Before**: Record video composition time (baseline)
2. **Deploy**: Apply Terraform changes with CPU boost
3. **After**: Record video composition time (with boost)
4. **Compare**: Calculate percentage improvement

Expected improvement: 30-50% faster processing times.

## Deployment

Deploy using standard workflow:

```bash
make backend-deploy
```

Or manually:

```bash
cd infra/environments/dev
terraform plan
terraform apply
```

## Notes

- CPU boost is automatically applied during cold starts
- No additional cost for CPU boost feature
- Particularly beneficial for FFmpeg video composition operations
