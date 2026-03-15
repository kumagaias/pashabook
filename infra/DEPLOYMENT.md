# Deployment Guide

This guide explains how to deploy Pashabook MVP to Google Cloud Platform using Terraform.

## Prerequisites

1. **Google Cloud SDK**
   ```bash
   # Install gcloud CLI
   # macOS: brew install google-cloud-sdk
   # Or download from: https://cloud.google.com/sdk/docs/install
   
   # Login and set project
   gcloud auth login
   gcloud auth application-default login
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Terraform**
   ```bash
   # Install Terraform
   # macOS: brew install terraform
   # Or download from: https://www.terraform.io/downloads
   ```

3. **Firebase CLI**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

4. **Docker** (for Cloud Run worker)
   ```bash
   # macOS: brew install docker
   # Or download from: https://www.docker.com/products/docker-desktop
   ```

## Step 1: Create GCP Project

```bash
# Create new project
gcloud projects create YOUR_PROJECT_ID --name="Pashabook"

# Set as active project
gcloud config set project YOUR_PROJECT_ID

# Enable billing (required)
# Go to: https://console.cloud.google.com/billing
```

## Step 2: Initialize Firebase

```bash
# Initialize Firebase in the project
firebase projects:addfirebase YOUR_PROJECT_ID

# Or link existing Firebase project
firebase use YOUR_PROJECT_ID
```

## Step 3: Build and Push Docker Image

```bash
# Build Cloud Run worker image using Cloud Build
cd backend
gcloud builds submit --tag asia-northeast1-docker.pkg.dev/YOUR_PROJECT_ID/pashabook/backend:latest

# Or use Docker (requires Artifact Registry authentication)
docker build -t asia-northeast1-docker.pkg.dev/YOUR_PROJECT_ID/pashabook/backend:latest .
docker push asia-northeast1-docker.pkg.dev/YOUR_PROJECT_ID/pashabook/backend:latest
```

## Step 4: Configure Terraform

```bash
cd infra/environments/dev

# Copy example variables
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars
# Set your project_id
nano terraform.tfvars
```

Example `terraform.tfvars`:
```hcl
project_id = "your-project-id"
region     = "asia-northeast1"
```

## Step 5: Deploy Infrastructure with Terraform

```bash
cd infra/environments/dev

# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Apply infrastructure
terraform apply
```

This will create:
- ✅ Firestore database
- ✅ Cloud Storage buckets (uploads, videos, audio, images, assets, functions-source)
- ✅ Cloud Tasks queue
- ✅ Service account with permissions
- ✅ Cloud Run worker service
- ✅ Artifact Registry repository

## Step 6: Deploy Firestore and Storage Rules

```bash
# Deploy Firebase rules
firebase deploy --only firestore:rules,storage
```

## Step 7: Enable Firebase Authentication

1. Go to Firebase Console: https://console.firebase.google.com
2. Select your project
3. Go to Authentication → Sign-in method
4. Enable "Email/Password" authentication

## Step 8: Configure Mobile App

Get the Terraform outputs:

```bash
cd infra/environments/dev
terraform output
```

Create mobile app `.env` file:

```bash
cd mobile
cp .env.example .env
```

Edit `mobile/.env`:
```bash
# Get these from Terraform outputs
EXPO_PUBLIC_API_URL=<worker_url from terraform output>

# Get these from Firebase Console → Project Settings
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=PROJECT_ID.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=PROJECT_ID.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
```

## Step 9: Test Deployment

```bash
# Check Cloud Run worker
cd infra/environments/dev
WORKER_URL=$(terraform output -raw worker_url)
curl $WORKER_URL/health

# View logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=pashabook-worker" --limit 50
```

## Step 10: Run Mobile App

```bash
cd mobile
npm install
npx expo start
```

## Updating Infrastructure

### Update Cloud Run Worker

```bash
# Build new image
cd backend
gcloud builds submit --tag asia-northeast1-docker.pkg.dev/YOUR_PROJECT_ID/pashabook/backend:v1.0.1

# Update Terraform variable
cd infra/environments/dev
# Edit terraform.tfvars:
# worker_image = "asia-northeast1-docker.pkg.dev/YOUR_PROJECT_ID/pashabook/backend:v1.0.1"

# Apply changes
terraform apply
```

## Monitoring

### View Logs

```bash
# Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=pashabook-worker" --limit 50

# Cloud Tasks logs
gcloud logging read "resource.type=cloud_tasks_queue" --limit 50

# Or use the watch script
./infra/scripts/watch-logs.sh
```

### View Metrics

```bash
# Cloud Run metrics
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_count"'
```

## Cleanup

To destroy all infrastructure:

```bash
cd infra/environments/dev
terraform destroy
```

**Warning**: This will delete all data including Firestore database and Cloud Storage buckets.

## Troubleshooting

### Issue: Terraform fails with "API not enabled"

**Solution**: Wait a few minutes after enabling APIs, then retry:
```bash
terraform apply
```

### Issue: Cloud Run worker fails to start

**Solution**: Check Docker image exists:
```bash
gcloud artifacts docker images list asia-northeast1-docker.pkg.dev/YOUR_PROJECT_ID/pashabook
```

### Issue: Authentication errors in mobile app

**Solution**: Verify Firebase configuration:
1. Check `.env` file has correct values
2. Verify Email/Password auth is enabled in Firebase Console
3. Check API keys are valid

## Cost Estimation

With 24-hour data retention and moderate usage:

- **Firestore**: ~$0.50/day (1000 jobs)
- **Cloud Storage**: ~$0.10/day (temporary files)
- **Cloud Run**: ~$2.00/day (100 jobs)
- **Vertex AI**: ~$5.00/day (Gemini + Imagen)
- **Cloud TTS**: ~$0.50/day (500 pages)

**Total**: ~$8-9/day for moderate usage

## Production Considerations

For production deployment:

1. **Increase TTL**: Change lifecycle rules from 1 day to 7-30 days
2. **Add CDN**: Use Cloud CDN for video delivery
3. **Add monitoring**: Set up Cloud Monitoring alerts
4. **Add backup**: Enable Firestore backups
5. **Add security**: Implement rate limiting and DDoS protection
6. **Add CI/CD**: Set up automated deployments
7. **Add staging**: Create separate staging environment
