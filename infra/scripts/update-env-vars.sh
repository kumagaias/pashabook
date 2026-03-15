#!/bin/bash

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Update Cloud Run Environment Vars    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check prerequisites
if [ -z "$GCP_PROJECT_ID" ]; then
    GCP_PROJECT_ID="pashabook-dev"
    echo -e "${YELLOW}⚠ GCP_PROJECT_ID not set, using default: $GCP_PROJECT_ID${NC}"
fi

if [ -z "$GCP_REGION" ]; then
    GCP_REGION="asia-northeast1"
    echo -e "${YELLOW}⚠ GCP_REGION not set, using default: $GCP_REGION${NC}"
fi

SERVICE_NAME="pashabook-worker"

echo -e "${GREEN}✓ Project: $GCP_PROJECT_ID${NC}"
echo -e "${GREEN}✓ Region: $GCP_REGION${NC}"
echo -e "${GREEN}✓ Service: $SERVICE_NAME${NC}"
echo ""

# Get infrastructure values
echo -e "${BLUE}Getting infrastructure values...${NC}"
UPLOADS_BUCKET="${GCP_PROJECT_ID}-pashabook-uploads"
VIDEOS_BUCKET="${GCP_PROJECT_ID}-pashabook-videos"
AUDIO_BUCKET="${GCP_PROJECT_ID}-pashabook-audio"
IMAGES_BUCKET="${GCP_PROJECT_ID}-pashabook-images"
ASSETS_BUCKET="${GCP_PROJECT_ID}-pashabook-assets"
TASKS_QUEUE="dev-processing"
PROJECT_NUMBER=$(gcloud projects describe $GCP_PROJECT_ID --format="value(projectNumber)")
CLOUD_RUN_URL="https://${SERVICE_NAME}-${PROJECT_NUMBER}.${GCP_REGION}.run.app"

echo -e "${GREEN}✓ Infrastructure values retrieved${NC}"
echo ""

# Show current environment variables
echo -e "${BLUE}Current environment variables:${NC}"
gcloud run services describe $SERVICE_NAME \
  --region=$GCP_REGION \
  --format="table(spec.template.spec.containers[0].env)" || true
echo ""

# Update environment variables
echo -e "${BLUE}Updating environment variables...${NC}"
gcloud run services update $SERVICE_NAME \
  --region=$GCP_REGION \
  --update-env-vars "GCP_PROJECT_ID=$GCP_PROJECT_ID" \
  --update-env-vars "GCP_REGION=$GCP_REGION" \
  --update-env-vars "GCP_LOCATION=$GCP_REGION" \
  --update-env-vars "STORAGE_BUCKET_UPLOADS=$UPLOADS_BUCKET" \
  --update-env-vars "STORAGE_BUCKET_VIDEOS=$VIDEOS_BUCKET" \
  --update-env-vars "STORAGE_BUCKET_AUDIO=$AUDIO_BUCKET" \
  --update-env-vars "STORAGE_BUCKET_IMAGES=$IMAGES_BUCKET" \
  --update-env-vars "TASKS_QUEUE=$TASKS_QUEUE" \
  --update-env-vars "VERTEX_AI_LOCATION=$GCP_REGION" \
  --update-env-vars "CLOUD_RUN_SERVICE_URL=$CLOUD_RUN_URL" \
  --update-env-vars "BGM_STORAGE_PATH=gs://$ASSETS_BUCKET/bgm/"

echo ""
echo -e "${GREEN}✓ Environment variables updated successfully!${NC}"
echo ""

# Show updated environment variables
echo -e "${BLUE}Updated environment variables:${NC}"
gcloud run services describe $SERVICE_NAME \
  --region=$GCP_REGION \
  --format="table(spec.template.spec.containers[0].env)"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Update Complete!                      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo "Service URL: $CLOUD_RUN_URL"
echo ""
