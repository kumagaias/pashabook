#!/bin/bash

# Watch Cloud Run logs for pashabook-worker
# Usage: ./watch-logs.sh

echo "Watching logs for pashabook-worker..."
echo "Press Ctrl+C to stop"
echo ""

while true; do
  echo "=== $(date '+%H:%M:%S') ==="
  
  # Get logs from last 2 minutes
  gcloud logging read \
    "resource.type=cloud_run_revision AND resource.labels.service_name=pashabook-worker" \
    --limit=20 \
    --format=json \
    --project=pashabook-dev \
    --freshness=2m 2>/dev/null | \
    jq -r '.[] | "\(.timestamp) [\(.severity)] \(.textPayload // (.httpRequest.requestMethod + " " + (.httpRequest.status|tostring)))"' | \
    grep -v "GET 304" | \
    head -20
  
  echo ""
  sleep 5
done
