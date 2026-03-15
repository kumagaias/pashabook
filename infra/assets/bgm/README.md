# BGM Files for Pashabook

This directory contains background music tracks used in generated storybook videos.

## Required Files

You need to add 4 royalty-free BGM tracks to this directory:

1. **bright.mp3** - Upbeat, cheerful music for happy/bright stories
2. **adventure.mp3** - Exciting, energetic music for adventure stories
3. **sad.mp3** - Gentle, melancholic music for sad/emotional stories
4. **calm.mp3** - Peaceful, soothing music for calm/relaxing stories

## File Requirements

- **Format**: MP3
- **Duration**: 30-60 seconds (will be looped to match video length)
- **Quality**: 128-192 kbps recommended
- **License**: Must be royalty-free or Creative Commons licensed
- **Volume**: Normalized to consistent levels (BGM will be mixed at 20-30% of narration volume)

## Recommended Sources for Royalty-Free Music

### Free Options (Creative Commons)
1. **YouTube Audio Library** (https://studio.youtube.com/channel/UC/music)
   - Filter by "No attribution required"
   - Search for: "happy children", "adventure kids", "gentle piano", "calm ambient"

2. **Free Music Archive** (https://freemusicarchive.org/)
   - Filter by CC0 or CC BY licenses
   - Categories: Children's Music, Ambient, Instrumental

3. **Incompetech** (https://incompetech.com/music/royalty-free/)
   - By Kevin MacLeod (CC BY 4.0)
   - Search for: "Carefree", "Sneaky Adventure", "Meditation", "Wallpaper"

4. **Pixabay Music** (https://pixabay.com/music/)
   - Free for commercial use, no attribution required
   - Search for: "children", "adventure", "calm", "emotional"

### Paid Options (Royalty-Free)
1. **Epidemic Sound** (https://www.epidemicsound.com/)
2. **AudioJungle** (https://audiojungle.net/)
3. **Artlist** (https://artlist.io/)

## Example Track Suggestions

### Bright/Happy
- "Carefree" by Kevin MacLeod
- "Happy Alley" by Kevin MacLeod
- Search: "upbeat children", "cheerful ukulele", "happy whistling"

### Adventure
- "Sneaky Adventure" by Kevin MacLeod
- "Cipher" by Kevin MacLeod
- Search: "adventure kids", "playful orchestral", "exciting journey"

### Sad/Emotional
- "Meditation Impromptu 01" by Kevin MacLeod
- "Wallpaper" by Kevin MacLeod
- Search: "gentle piano", "emotional strings", "melancholic"

### Calm/Peaceful
- "Meditation Impromptu 02" by Kevin MacLeod
- "Ambient Piano" by various artists
- Search: "calm ambient", "peaceful piano", "relaxing nature"

## How to Add Files

1. Download 4 BGM tracks from the sources above
2. Rename them to match the required filenames:
   - `bright.mp3`
   - `adventure.mp3`
   - `sad.mp3`
   - `calm.mp3`
3. Place them in this directory (`infra/assets/bgm/`)
4. Run the upload script: `./infra/scripts/upload-bgm.sh`

## Upload to Cloud Storage

After adding the files, run:

```bash
cd infra
GCP_PROJECT_ID=pashabook-dev ./scripts/upload-bgm.sh
```

This will upload the files to:
- `gs://pashabook-dev-pashabook-assets/bgm/bright.mp3`
- `gs://pashabook-dev-pashabook-assets/bgm/adventure.mp3`
- `gs://pashabook-dev-pashabook-assets/bgm/sad.mp3`
- `gs://pashabook-dev-pashabook-assets/bgm/calm.mp3`

## Verify Upload

```bash
gsutil ls gs://pashabook-dev-pashabook-assets/bgm/
```

## Environment Variable

After uploading, set the BGM_STORAGE_PATH environment variable in Cloud Run:

```bash
BGM_STORAGE_PATH=gs://pashabook-dev-pashabook-assets/bgm/
```

This is configured in Terraform (see Task 28.4).

## License Compliance

**IMPORTANT**: Ensure all BGM tracks are properly licensed for commercial use. Keep track of:
- Track name and artist
- License type (CC0, CC BY, etc.)
- Attribution requirements (if any)
- Source URL

Consider adding a `LICENSES.txt` file in this directory documenting each track's license.

## Notes

- BGM files are NOT included in the repository due to licensing and file size
- Each developer/deployment environment must add their own BGM files
- For production, consider using higher quality tracks (256 kbps)
- Test BGM volume levels with actual narration to ensure proper mixing
