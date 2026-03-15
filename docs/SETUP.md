# Pashabook Setup Guide

Complete setup instructions for the Pashabook MVP project.

## Prerequisites

1. **Node.js 20 (LTS)**
   ```bash
   # Using mise/asdf (recommended)
   mise install
   # Or manually install Node.js 20 from nodejs.org
   ```

2. **Terraform 1.10+**
   ```bash
   # macOS
   brew install terraform
   
   # Or using mise/asdf
   mise install terraform
   ```

3. **Google Cloud SDK**
   ```bash
   # macOS
   brew install google-cloud-sdk
   
   # Authenticate
   gcloud auth login
   gcloud auth application-default login
   ```

4. **Firebase CLI**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

5. **gitleaks (Security scanning)**
   ```bash
   brew install gitleaks
   ```

## Google Cloud Project Setup

### 1. Create GCP Project

```bash
# Set project ID
export GCP_PROJECT_ID=pashabook-mvp-$(date +%s)

# Create project
gcloud projects create $GCP_PROJECT_ID --name="Pashabook MVP"

# Set as active project
gcloud config set project $GCP_PROJECT_ID

# Enable billing (required for APIs)
# Visit: https://console.cloud.google.com/billing
```

### 2. Enable Required APIs

APIs are enabled automatically via Terraform, but you can enable manually:

```bash
gcloud services enable \
  firestore.googleapis.com \
  storage.googleapis.com \
  cloudfunctions.googleapis.com \
  run.googleapis.com \
  cloudtasks.googleapis.com \
  aiplatform.googleapis.com \
  texttospeech.googleapis.com \
  cloudscheduler.googleapis.com \
  logging.googleapis.com
```

### 3. Create Service Account

```bash
# Create service account
gcloud iam service-accounts create pashabook-backend \
  --display-name="Pashabook Backend Service Account"

# Grant necessary roles
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:pashabook-backend@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:pashabook-backend@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# Download service account key
gcloud iam service-accounts keys create service-account-key.json \
  --iam-account=pashabook-backend@$GCP_PROJECT_ID.iam.gserviceaccount.com

# Set environment variable
export GOOGLE_APPLICATION_CREDENTIALS=$(pwd)/service-account-key.json
```

## Firebase Setup

### 1. Create Firebase Project

```bash
# Initialize Firebase in existing GCP project
firebase projects:addfirebase $GCP_PROJECT_ID

# Or create new Firebase project
firebase projects:create
```

### 2. Enable Authentication

1. Go to Firebase Console: https://console.firebase.google.com
2. Select your project
3. Navigate to Authentication > Sign-in method
4. Enable "Email/Password" provider
5. Save changes

### 3. Initialize Firestore

```bash
# Initialize Firestore in native mode
firebase firestore:databases:create --project $GCP_PROJECT_ID
```

### 4. Get Firebase Config

1. Go to Project Settings > General
2. Scroll to "Your apps" section
3. Click "Add app" > Web
4. Register app and copy the config object
5. Save config for mobile app setup

## Infrastructure Deployment

### 1. Configure Terraform

```bash
cd infra/terraform

# Copy example variables
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars
# Set project_id, region, and firebase_config
nano terraform.tfvars
```

### 2. Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Review planned changes
terraform plan

# Apply changes
terraform apply
```

### 3. Deploy Security Rules

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules --project $GCP_PROJECT_ID

# Deploy Storage rules
firebase deploy --only storage:rules --project $GCP_PROJECT_ID
```

## Backend Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

Required environment variables:
- `GCP_PROJECT_ID`: Your GCP project ID
- `GCP_REGION`: GCP region (default: us-central1)
- `STORAGE_BUCKET`: Cloud Storage bucket name
- `TASKS_QUEUE`: Cloud Tasks queue name

### 3. Build and Deploy

```bash
# Build Docker image
docker build -t gcr.io/$GCP_PROJECT_ID/pashabook-worker .

# Push to Container Registry
docker push gcr.io/$GCP_PROJECT_ID/pashabook-worker

# Deploy to Cloud Run
gcloud run deploy pashabook-worker \
  --image gcr.io/$GCP_PROJECT_ID/pashabook-worker \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GCP_PROJECT_ID=$GCP_PROJECT_ID
```

## Mobile App Setup

### 1. Install Dependencies

```bash
cd mobile
npm install
```

### 2. Configure Firebase

```bash
# Copy example env file
cp .env.example .env

# Edit .env with Firebase config from Firebase Console
nano .env
```

### 3. Run Development Server

```bash
# Start Expo development server
npm start

# Or run on specific platform
npm run ios      # iOS simulator
npm run android  # Android emulator
```

## Verification

### 1. Test Backend

```bash
# Check Cloud Run service
gcloud run services describe pashabook-worker --region us-central1

# Test health endpoint
curl https://your-cloud-run-url/health
```

### 2. Test Mobile App

1. Open app in Expo Go or simulator
2. Register a new account
3. Upload a test image
4. Verify job processing

### 3. Check Logs

```bash
# View Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision" --limit 50

# View Firestore data
firebase firestore:get /jobs --project $GCP_PROJECT_ID
```

## Troubleshooting

### Common Issues

**Issue: API not enabled**
```bash
# Enable specific API
gcloud services enable [API_NAME]
```

**Issue: Permission denied**
```bash
# Check service account permissions
gcloud projects get-iam-policy $GCP_PROJECT_ID
```

**Issue: Firestore rules blocking access**
```bash
# Redeploy rules
firebase deploy --only firestore:rules --project $GCP_PROJECT_ID
```

**Issue: Cloud Run deployment fails**
```bash
# Check build logs
gcloud builds list --limit 5

# View specific build
gcloud builds log [BUILD_ID]
```

## Next Steps

1. Configure monitoring and alerting
2. Set up CI/CD pipeline
3. Add error tracking (e.g., Sentry)
4. Configure custom domain
5. Set up staging environment

## Support

For issues or questions:
- Check logs in Cloud Logging
- Review Firestore security rules
- Verify API quotas and limits
- Check service account permissions
