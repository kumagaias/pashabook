# BGM Implementation Summary - Task 28.3

## Overview

Completed infrastructure setup for BGM (Background Music) integration in Pashabook storybook videos.

## What Was Implemented

### 1. Directory Structure Created

```
infra/
├── assets/
│   └── bgm/
│       ├── README.md          # Detailed guide for obtaining BGM files
│       ├── .gitignore         # Prevents committing MP3 files
│       ├── LICENSES.txt       # Template for license documentation
│       └── [*.mp3 files]      # To be added manually by developers
├── scripts/
│   └── upload-bgm.sh          # Automated upload script
├── BGM_SETUP.md               # Quick reference guide
└── BGM_IMPLEMENTATION_SUMMARY.md  # This file
```

### 2. Upload Script (`infra/scripts/upload-bgm.sh`)

**Features:**
- Validates presence of all 4 required BGM files
- Checks if Cloud Storage bucket exists
- Uploads files with proper cache headers (1 year cache)
- Sets public read permissions
- Provides clear success/error messages
- Includes verification commands

**Usage:**
```bash
cd infra
GCP_PROJECT_ID=pashabook-dev ./scripts/upload-bgm.sh
```

### 3. Terraform Configuration Update

**File:** `infra/modules/gcp/pashabook/main.tf`

**Change:** Added BGM_STORAGE_PATH environment variable to Cloud Run:
```terraform
env {
  name  = "BGM_STORAGE_PATH"
  value = "gs://${google_storage_bucket.assets.name}/bgm/"
}
```

**Result:** Cloud Run worker will have access to BGM files at:
- `gs://pashabook-dev-pashabook-assets/bgm/bright.mp3`
- `gs://pashabook-dev-pashabook-assets/bgm/adventure.mp3`
- `gs://pashabook-dev-pashabook-assets/bgm/sad.mp3`
- `gs://pashabook-dev-pashabook-assets/bgm/calm.mp3`

### 4. Documentation

**Created 3 comprehensive guides:**

1. **`infra/assets/bgm/README.md`** (3.9 KB)
   - Detailed instructions for obtaining royalty-free BGM
   - Recommended sources (YouTube Audio Library, Free Music Archive, etc.)
   - File requirements and specifications
   - Example track suggestions for each emotional tone
   - License compliance guidelines

2. **`infra/BGM_SETUP.md`** (4.5 KB)
   - Quick reference for setup process
   - Step-by-step instructions
   - Verification commands
   - Troubleshooting guide
   - Environment variable reference

3. **`infra/assets/bgm/LICENSES.txt`**
   - Template for documenting BGM licenses
   - Example entries for Kevin MacLeod tracks
   - License compliance notes

## Required BGM Files

Developers must manually add 4 MP3 files to `infra/assets/bgm/`:

| File | Purpose | Emotional Tone | Duration |
|------|---------|----------------|----------|
| `bright.mp3` | Happy/cheerful stories | Bright, upbeat | 30-60s |
| `adventure.mp3` | Exciting stories | Energetic, adventurous | 30-60s |
| `sad.mp3` | Emotional stories | Gentle, melancholic | 30-60s |
| `calm.mp3` | Peaceful stories | Soothing, calm | 30-60s |

**Why not included in repo:**
- Licensing restrictions (must verify each track's license)
- File size (MP3 files are large)
- Each deployment environment may use different tracks

## Next Steps for Developers

### Step 1: Obtain BGM Files

Download 4 royalty-free BGM tracks from recommended sources:
- **YouTube Audio Library** (easiest, no attribution required)
- **Incompetech** (Kevin MacLeod, CC BY 4.0)
- **Free Music Archive** (various licenses)
- **Pixabay Music** (free, no attribution)

See `infra/assets/bgm/README.md` for detailed recommendations.

### Step 2: Add Files to Repository

```bash
# Copy your BGM files to the assets directory
cp /path/to/your/bright.mp3 infra/assets/bgm/
cp /path/to/your/adventure.mp3 infra/assets/bgm/
cp /path/to/your/sad.mp3 infra/assets/bgm/
cp /path/to/your/calm.mp3 infra/assets/bgm/
```

### Step 3: Document Licenses

Edit `infra/assets/bgm/LICENSES.txt` and add license information for each track.

### Step 4: Upload to Cloud Storage

```bash
cd infra
GCP_PROJECT_ID=pashabook-dev ./scripts/upload-bgm.sh
```

### Step 5: Deploy Infrastructure

```bash
cd infra/environments/dev
terraform apply
```

This will set the `BGM_STORAGE_PATH` environment variable in Cloud Run.

### Step 6: Deploy Backend

```bash
make backend-deploy
```

Or push to `main` branch for automatic GitHub Actions deployment.

## Verification

After completing all steps, verify the setup:

```bash
# Check files in Cloud Storage
gsutil ls gs://pashabook-dev-pashabook-assets/bgm/

# Expected output:
# gs://pashabook-dev-pashabook-assets/bgm/adventure.mp3
# gs://pashabook-dev-pashabook-assets/bgm/bright.mp3
# gs://pashabook-dev-pashabook-assets/bgm/calm.mp3
# gs://pashabook-dev-pashabook-assets/bgm/sad.mp3

# Check Cloud Run environment variables
gcloud run services describe pashabook-worker \
  --region=asia-northeast1 \
  --format="value(spec.template.spec.containers[0].env)"

# Should include:
# BGM_STORAGE_PATH=gs://pashabook-dev-pashabook-assets/bgm/
```

## Integration with VideoCompositor

The BGM files will be used by `VideoCompositor` (Task 32.1):

1. **Emotional tone mapping:**
   - `bright/happy` → `bright.mp3`
   - `adventure/exciting` → `adventure.mp3`
   - `sad/melancholic` → `sad.mp3`
   - `calm/peaceful` → `calm.mp3`

2. **Audio processing:**
   - BGM looped to match video length
   - Mixed at 20-30% of narration volume
   - 1-second fade-in at start
   - 1-second fade-out at end

3. **Implementation location:**
   - `backend/src/services/VideoCompositor.ts`
   - Method: `selectBGM(emotionalTone: string): string`
   - Method: `mixAudioWithBGM(narrationFiles: string[], bgmFile: string): string`

## Task Completion Status

### ✅ Completed (Task 28.3)

- [x] Created BGM directory structure
- [x] Created upload script (`upload-bgm.sh`)
- [x] Added BGM_STORAGE_PATH to Terraform configuration
- [x] Created comprehensive documentation
- [x] Added .gitignore to prevent committing MP3 files
- [x] Created license documentation template

### ⏭️ Next Tasks

- [ ] **Task 28.4**: Deploy Terraform changes to set BGM_STORAGE_PATH
- [ ] **Task 32.1**: Implement BGM selection in VideoCompositor
- [ ] **Task 32.2**: Write unit tests for BGM integration
- [ ] **Manual**: Obtain and upload actual BGM files

## Files Created/Modified

### Created Files (7)
1. `infra/scripts/upload-bgm.sh` - Upload automation script
2. `infra/assets/bgm/README.md` - BGM sourcing guide
3. `infra/assets/bgm/.gitignore` - Prevent committing MP3 files
4. `infra/assets/bgm/LICENSES.txt` - License documentation template
5. `infra/BGM_SETUP.md` - Quick reference guide
6. `infra/BGM_IMPLEMENTATION_SUMMARY.md` - This file

### Modified Files (1)
1. `infra/modules/gcp/pashabook/main.tf` - Added BGM_STORAGE_PATH env var

## Notes

- BGM files are NOT included in the repository
- Each developer/environment must add BGM files manually
- Upload script validates all 4 files are present before uploading
- Files are cached for 1 year in Cloud Storage (performance optimization)
- Public read access is set automatically by the upload script

## References

- **Requirements**: 18.1, 18.2
- **Design**: VideoCompositor section, Infrastructure Configuration
- **Related Tasks**: 28.4 (env vars), 32.1 (BGM selection), 32.2 (tests)
