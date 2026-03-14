# BGM Setup Checklist

Quick checklist for completing BGM setup for Pashabook.

## Prerequisites

- [ ] GCP project configured (`pashabook-dev`)
- [ ] `gcloud` CLI installed and authenticated
- [ ] `gsutil` available (comes with gcloud)
- [ ] Terraform infrastructure deployed (Cloud Storage bucket exists)

## Step-by-Step Checklist

### 1. Obtain BGM Files

- [ ] Download `bright.mp3` (happy/cheerful, 30-60s)
- [ ] Download `adventure.mp3` (exciting/energetic, 30-60s)
- [ ] Download `sad.mp3` (gentle/melancholic, 30-60s)
- [ ] Download `calm.mp3` (peaceful/soothing, 30-60s)

**Recommended source**: YouTube Audio Library
- URL: https://studio.youtube.com/channel/UC/music
- Filter: "No attribution required"
- Search terms: "happy children", "adventure kids", "gentle piano", "calm ambient"

See `infra/assets/bgm/README.md` for more sources and recommendations.

### 2. Add Files to Repository

```bash
# Copy files to assets directory
cp /path/to/your/bright.mp3 infra/assets/bgm/
cp /path/to/your/adventure.mp3 infra/assets/bgm/
cp /path/to/your/sad.mp3 infra/assets/bgm/
cp /path/to/your/calm.mp3 infra/assets/bgm/

# Verify files
ls -lh infra/assets/bgm/*.mp3
```

- [ ] `bright.mp3` added
- [ ] `adventure.mp3` added
- [ ] `sad.mp3` added
- [ ] `calm.mp3` added

### 3. Document Licenses

- [ ] Edit `infra/assets/bgm/LICENSES.txt`
- [ ] Add track name, artist, license type for each file
- [ ] Add source URL for each track
- [ ] Add attribution text (if required)

### 4. Upload to Cloud Storage

```bash
cd infra
GCP_PROJECT_ID=pashabook-dev ./scripts/upload-bgm.sh
```

- [ ] Upload script executed successfully
- [ ] All 4 files uploaded
- [ ] No errors reported

### 5. Verify Upload

```bash
gsutil ls gs://pashabook-dev-pashabook-assets/bgm/
```

Expected output:
```
gs://pashabook-dev-pashabook-assets/bgm/adventure.mp3
gs://pashabook-dev-pashabook-assets/bgm/bright.mp3
gs://pashabook-dev-pashabook-assets/bgm/calm.mp3
gs://pashabook-dev-pashabook-assets/bgm/sad.mp3
```

- [ ] All 4 files visible in Cloud Storage
- [ ] File paths match expected format

### 6. Deploy Infrastructure (Terraform)

```bash
cd infra/environments/dev
terraform plan  # Review changes
terraform apply # Apply changes
```

- [ ] Terraform plan shows BGM_STORAGE_PATH addition
- [ ] Terraform apply completed successfully
- [ ] No errors during deployment

### 7. Verify Environment Variable

```bash
gcloud run services describe pashabook-worker \
  --region=asia-northeast1 \
  --format="value(spec.template.spec.containers[0].env)" | grep BGM
```

Expected output:
```
BGM_STORAGE_PATH=gs://pashabook-dev-pashabook-assets/bgm/
```

- [ ] BGM_STORAGE_PATH environment variable set
- [ ] Value matches expected path

### 8. Deploy Backend

```bash
make backend-deploy
```

Or push to `main` branch for automatic GitHub Actions deployment.

- [ ] Backend deployment completed
- [ ] Cloud Run service updated
- [ ] No deployment errors

### 9. Test BGM Integration

Generate a test storybook and verify:

- [ ] Upload a drawing and generate storybook
- [ ] Video generation completes successfully
- [ ] BGM is audible in the video
- [ ] BGM volume is appropriate (not overpowering narration)
- [ ] BGM matches story's emotional tone
- [ ] BGM loops smoothly throughout video
- [ ] 1-second fade-in at start
- [ ] 1-second fade-out at end

## Troubleshooting

### Upload script fails with "Bucket does not exist"

**Solution**: Deploy Terraform infrastructure first
```bash
cd infra/environments/dev
terraform apply
```

### Upload script fails with "Missing BGM files"

**Solution**: Ensure all 4 MP3 files are in `infra/assets/bgm/`
```bash
ls infra/assets/bgm/*.mp3
```

### Environment variable not set after Terraform apply

**Solution**: Redeploy Cloud Run service
```bash
make backend-deploy
```

### BGM not playing in generated videos

**Possible causes:**
1. BGM files not uploaded → Run upload script
2. Environment variable not set → Check with `gcloud run services describe`
3. VideoCompositor not implemented → Complete Task 32.1

## Completion Criteria

Task 28.3 is complete when:

- [x] Upload script created and executable
- [x] BGM directory structure created
- [x] Documentation created (README, SETUP, LICENSES)
- [x] Terraform configuration updated with BGM_STORAGE_PATH
- [ ] BGM files obtained and uploaded to Cloud Storage
- [ ] Terraform changes deployed
- [ ] Backend redeployed with new environment variable

**Note**: The first 4 items (marked with [x]) are complete. The remaining items require manual action by the developer.

## Next Steps

After completing this checklist:

1. **Task 28.4**: Verify all environment variables are set correctly
2. **Task 32.1**: Implement BGM selection in VideoCompositor
3. **Task 32.2**: Write unit tests for BGM integration

## Quick Reference

| Command | Purpose |
|---------|---------|
| `./infra/scripts/upload-bgm.sh` | Upload BGM files to Cloud Storage |
| `gsutil ls gs://pashabook-dev-pashabook-assets/bgm/` | List uploaded files |
| `terraform apply` | Deploy infrastructure changes |
| `make backend-deploy` | Deploy backend with new env vars |
| `gcloud run services describe pashabook-worker` | Check Cloud Run config |

## Documentation

- **Detailed guide**: `infra/assets/bgm/README.md`
- **Quick reference**: `infra/BGM_SETUP.md`
- **Implementation summary**: `infra/BGM_IMPLEMENTATION_SUMMARY.md`
- **This checklist**: `infra/BGM_CHECKLIST.md`
