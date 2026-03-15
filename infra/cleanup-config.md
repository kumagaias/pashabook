# Data Retention and Cleanup Configuration

This document describes the automated cleanup configuration for Pashabook MVP.

## Overview

All temporary data (videos, images, audio files, job records) are automatically deleted after 24 hours to minimize storage costs for the hackathon demo.

## Cloud Storage Lifecycle Policy

Configure lifecycle rules for all Cloud Storage buckets:

```bash
# Apply lifecycle policy to all buckets
gsutil lifecycle set storage-lifecycle.json gs://pashabook-uploads
gsutil lifecycle set storage-lifecycle.json gs://pashabook-videos
gsutil lifecycle set storage-lifecycle.json gs://pashabook-audio
gsutil lifecycle set storage-lifecycle.json gs://pashabook-images
```

See `storage-lifecycle.json` for the lifecycle configuration.

## Firestore TTL Configuration

Job records in Firestore are configured with a TTL (Time To Live) field:

- Field: `expiresAt`
- Type: Timestamp
- Value: `createdAt + 24 hours`

Firestore automatically deletes documents when `expiresAt` is reached.

### Enable Firestore TTL

1. Go to Firestore console
2. Navigate to the `jobs` collection
3. Enable TTL on the `expiresAt` field

Or use the Firebase CLI:

```bash
firebase firestore:ttl:enable jobs expiresAt
```

## Cloud Scheduler Configuration

Set up a Cloud Scheduler job to periodically clean up expired data:

```bash
# Create cleanup scheduler job
gcloud scheduler jobs create http cleanup-expired-data \
  --schedule="0 */6 * * *" \
  --uri="https://REGION-PROJECT_ID.cloudfunctions.net/cleanup" \
  --http-method=POST \
  --time-zone="UTC" \
  --description="Clean up expired data every 6 hours"
```

## Cleanup Function

The cleanup Cloud Function performs the following tasks:

1. Query Firestore for expired job records (where `expiresAt < now()`)
2. Delete associated Cloud Storage files
3. Delete Firestore job records
4. Log cleanup statistics

## Monitoring

Monitor cleanup operations in Cloud Logging:

```bash
gcloud logging read "resource.type=cloud_function AND resource.labels.function_name=cleanup" --limit 50
```

## Cost Optimization

With 24-hour TTL:
- Storage costs are minimal (only active jobs)
- No long-term storage fees
- Automatic cleanup reduces manual maintenance

## Production Considerations

For production deployment, consider:
- Extending TTL to 7-30 days
- Implementing user-controlled retention
- Adding backup/archive functionality
- Implementing soft deletes with recovery period
