#!/bin/bash

# Upload BGM files to Cloud Storage
# This script uploads royalty-free background music tracks to the assets bucket

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-pashabook-dev}"
BUCKET_NAME="${PROJECT_ID}-pashabook-assets"
# Get script directory and construct absolute path to BGM directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BGM_DIR="${SCRIPT_DIR}/../assets/bgm"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "BGM Upload Script"
echo "=========================================="
echo "Project ID: ${PROJECT_ID}"
echo "Bucket: gs://${BUCKET_NAME}/bgm/"
echo "Source: ${BGM_DIR}"
echo ""

# Check if BGM directory exists
if [ ! -d "${BGM_DIR}" ]; then
  echo -e "${RED}Error: BGM directory not found: ${BGM_DIR}${NC}"
  echo "Please create the directory and add BGM files first."
  exit 1
fi

# Check if BGM files exist
REQUIRED_FILES=("bright.mp3" "adventure.mp3" "sad.mp3" "calm.mp3")
MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "${BGM_DIR}/${file}" ]; then
    MISSING_FILES+=("${file}")
  fi
done

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
  echo -e "${RED}Error: Missing BGM files:${NC}"
  for file in "${MISSING_FILES[@]}"; do
    echo "  - ${file}"
  done
  echo ""
  echo "Please add all required BGM files to ${BGM_DIR}/"
  exit 1
fi

# Check if bucket exists
if ! gsutil ls "gs://${BUCKET_NAME}" > /dev/null 2>&1; then
  echo -e "${RED}Error: Bucket gs://${BUCKET_NAME} does not exist${NC}"
  echo "Please run 'terraform apply' first to create the bucket."
  exit 1
fi

# Upload BGM files
echo -e "${GREEN}Uploading BGM files...${NC}"
echo ""

for file in "${REQUIRED_FILES[@]}"; do
  echo "Uploading ${file}..."
  gsutil -h "Cache-Control:public, max-age=31536000" \
    cp "${BGM_DIR}/${file}" "gs://${BUCKET_NAME}/bgm/${file}"
  
  echo -e "${GREEN}✓ ${file} uploaded${NC}"
done

# Make BGM directory publicly readable (uniform bucket-level access)
echo ""
echo "Setting public access for BGM files..."
gsutil iam ch allUsers:objectViewer "gs://${BUCKET_NAME}" 2>/dev/null || {
  echo -e "${YELLOW}Note: Could not set public access via IAM. Files may require signed URLs.${NC}"
}

echo ""
echo -e "${GREEN}=========================================="
echo "BGM Upload Complete!"
echo "==========================================${NC}"
echo ""
echo "Uploaded files:"
for file in "${REQUIRED_FILES[@]}"; do
  echo "  - gs://${BUCKET_NAME}/bgm/${file}"
done
echo ""
echo "Verify files:"
echo "  gsutil ls gs://${BUCKET_NAME}/bgm/"
echo ""
echo "Next steps:"
echo "  1. Set BGM_STORAGE_PATH environment variable in Cloud Run"
echo "  2. Update Terraform configuration with BGM_STORAGE_PATH"
echo "  3. Deploy backend with 'make backend-deploy'"
