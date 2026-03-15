# BGM Setup Guide

Quick reference for setting up background music for Pashabook.

## Overview

Pashabook uses 4 BGM tracks that are selected based on the story's emotional tone:
- **bright.mp3** - Happy/cheerful stories
- **adventure.mp3** - Exciting/adventure stories
- **sad.mp3** - Sad/emotional stories
- **calm.mp3** - Peaceful/calm stories

## Setup Steps

### 1. Obtain BGM Files

Download 4 royalty-free BGM tracks (30-60 seconds each, MP3 format).

**Recommended source**: YouTube Audio Library (https://studio.youtube.com/channel/UC/music)
- Filter by "No attribution required"
- Search for appropriate moods

See `infra/assets/bgm/README.md` for detailed recommendations and sources.

### 2. Add Files to Repository

```bash
# Place BGM files in the assets directory
cp /path/to/your/bright.mp3 infra/assets/bgm/
cp /path/to/your/adventure.mp3 infra/assets/bgm/
cp /path/to/your/sad.mp3 infra/assets/bgm/
cp /path/to/your/calm.mp3 infra/assets/bgm/
```

**Note**: BGM files are gitignored and must be added manually by each developer.

### 3. Upload to Cloud Storage

```bash
cd infra
GCP_PROJECT_ID=pashabook-dev ./scripts/upload-bgm.sh
```

This uploads files to: `gs://pashabook-dev-pashabook-assets/bgm/`

### 4. Verify Upload

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

### 5. Deploy Infrastructure

The BGM_STORAGE_PATH environment variable is automatically configured in Terraform:

```bash
cd infra/environments/dev
terraform apply
```

This sets `BGM_STORAGE_PATH=gs://pashabook-dev-pashabook-assets/bgm/` in Cloud Run.

### 6. Deploy Backend

```bash
make backend-deploy
```

Or via GitHub Actions (automatic on push to main).

## Verification

Test BGM integration by generating a storybook:

1. Upload a drawing
2. Wait for generation to complete
3. Play the video and verify:
   - BGM is audible but not overpowering narration
   - BGM matches the story's emotional tone
   - BGM loops smoothly throughout the video
   - 1-second fade-in at start, 1-second fade-out at end

## Troubleshooting

### "BGM file not found" error

**Cause**: BGM files not uploaded to Cloud Storage

**Solution**:
```bash
cd infra
GCP_PROJECT_ID=pashabook-dev ./scripts/upload-bgm.sh
```

### BGM too loud or too quiet

**Cause**: Volume mixing issue in VideoCompositor

**Solution**: Adjust volume mixing in `backend/src/services/VideoCompositor.ts`
- Target: 20-30% of narration volume
- Use FFmpeg `-filter_complex` with `amix` filter

### BGM doesn't match emotional tone

**Cause**: Incorrect emotional tone mapping

**Solution**: Check `VideoCompositor.selectBGM()` method
- Verify emotional tone from ImageAnalyzer
- Ensure correct mapping: bright/happy → bright.mp3, etc.

## Environment Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `BGM_STORAGE_PATH` | `gs://pashabook-dev-pashabook-assets/bgm/` | Cloud Storage path for BGM files |

Configured in: `infra/modules/gcp/pashabook/main.tf`

## File Structure

```
infra/
├── assets/
│   └── bgm/
│       ├── README.md          # Detailed BGM sourcing guide
│       ├── .gitignore         # Ignore MP3 files
│       ├── bright.mp3         # (not in repo, add manually)
│       ├── adventure.mp3      # (not in repo, add manually)
│       ├── sad.mp3            # (not in repo, add manually)
│       └── calm.mp3           # (not in repo, add manually)
├── scripts/
│   └── upload-bgm.sh          # Upload script
└── BGM_SETUP.md               # This file
```

## License Compliance

**IMPORTANT**: Ensure all BGM tracks are properly licensed for commercial use.

Document licenses in `infra/assets/bgm/LICENSES.txt`:
```
bright.mp3
- Track: "Carefree" by Kevin MacLeod
- License: CC BY 4.0
- Source: https://incompetech.com/music/royalty-free/
- Attribution: "Carefree" Kevin MacLeod (incompetech.com) Licensed under CC BY 4.0

adventure.mp3
- Track: "Sneaky Adventure" by Kevin MacLeod
- License: CC BY 4.0
- Source: https://incompetech.com/music/royalty-free/
- Attribution: "Sneaky Adventure" Kevin MacLeod (incompetech.com) Licensed under CC BY 4.0

...
```

## Related Tasks

- Task 28.3: Upload BGM files to Cloud Storage (this guide)
- Task 28.4: Configure environment variables (BGM_STORAGE_PATH)
- Task 32.1: Implement BGM selection in VideoCompositor
- Task 32.2: Write unit tests for BGM integration

## Next Steps

After completing BGM setup:
1. ✅ BGM files uploaded to Cloud Storage
2. ✅ BGM_STORAGE_PATH configured in Cloud Run
3. ⏭️ Implement BGM selection in VideoCompositor (Task 32.1)
4. ⏭️ Write unit tests for BGM integration (Task 32.2)
