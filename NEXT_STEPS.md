# Next Steps for Pashabook MVP

## Current Status

✅ Backend implementation complete
✅ Mobile app implementation complete
✅ All tests passing (Backend: 146 tests, Mobile: all tests)
⚠️ Infrastructure needs to be deployed to new GCP project

## Required Setup

### 1. Create GCP Project

Create a new GCP project named `pashabook-dev`:

```bash
# Create project
gcloud projects create pashabook-dev --name="Pashabook Development"

# Set as active project
gcloud config set project pashabook-dev

# Enable billing (required for Cloud Run, Vertex AI, etc.)
# Visit: https://console.cloud.google.com/billing/linkedaccount?project=pashabook-dev
```

### 2. Deploy Infrastructure with Terraform

```bash
cd infra/terraform

# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Apply infrastructure
terraform apply
```

This will create:
- Cloud Storage buckets (uploads, images, videos, audio, functions source)
- Firestore database
- Cloud Tasks queue
- Service account with necessary permissions
- Enable required APIs

### 3. Deploy Backend to Cloud Run

```bash
cd infra
./deploy.sh
```

This will:
- Build Docker image using Cloud Build
- Deploy to Cloud Run in asia-northeast1
- Configure environment variables
- Set up proper IAM permissions

### 4. Configure Firebase

#### Step 1: Create Firebase Project

1. Visit: https://console.firebase.google.com
2. Click "Add project"
3. Select existing GCP project: `pashabook-dev`
4. Enable Google Analytics (optional)
5. Create project

#### Step 2: Enable Authentication

1. Go to Authentication section
2. Click "Get started"
3. Enable "Email/Password" sign-in method

#### Step 3: Get Firebase Configuration

1. Go to Project Settings: https://console.firebase.google.com/project/pashabook-dev/settings/general
2. Scroll down to "Your apps" section
3. Click "Add app" and select "Web" (for Expo)
4. Register app with nickname: "Pashabook Mobile"
5. Copy the configuration values

#### Step 4: Update mobile/.env

Replace the placeholder values in `mobile/.env`:

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=<your-api-key>
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<your-sender-id>
EXPO_PUBLIC_FIREBASE_APP_ID=<your-app-id>
```

Also update the backend API URL after deployment:
```bash
EXPO_PUBLIC_API_BASE_URL=<cloud-run-url-from-deployment>
```

### 5. Deploy Firestore Security Rules

```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in project (if not done)
firebase init firestore

# Deploy rules
firebase deploy --only firestore:rules

# Deploy storage rules
firebase deploy --only storage:rules
```

## Testing the Application

### Backend Health Check

After deployment, test the backend:

```bash
curl <cloud-run-url>/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "service": "pashabook-worker",
  "version": "1.0.0"
}
```

### Mobile App Testing

After Firebase configuration is complete:

```bash
cd mobile
npm start
```

Then:
- Press `i` for iOS simulator (macOS only)
- Press `a` for Android emulator
- Press `w` for web browser
- Scan QR code with Expo Go app on physical device

## Architecture Overview

```
┌─────────────────┐
│  Mobile App     │
│  (React Native) │
└────────┬────────┘
         │
         │ HTTPS
         │
┌────────▼────────────────────────┐
│  Backend API (Cloud Run)        │
│  - /api/upload                  │
│  - /api/status/:jobId           │
│  - /api/video/:jobId            │
│  - /api/user/register           │
│  - /api/user/profile            │
└────────┬────────────────────────┘
         │
         │
    ┌────▼─────┬──────────┬──────────┐
    │          │          │          │
┌───▼───┐ ┌───▼───┐ ┌───▼────┐ ┌──▼──────┐
│Firestore│ │Storage│ │Vertex AI│ │Cloud TTS│
└─────────┘ └───────┘ └─────────┘ └─────────┘
```

## Estimated Costs

For development/testing with moderate usage:
- Cloud Run: ~$5-10/month
- Cloud Storage: ~$1-5/month
- Firestore: Free tier (up to 1GB, 50K reads/day)
- Vertex AI (Gemini, Imagen): Pay per use (~$0.50-2 per storybook)
- Cloud TTS: ~$4 per 1M characters

Total estimated: ~$10-30/month for development

## Troubleshooting

### Common Issues

1. **Terraform fails with "project not found"**
   - Ensure project is created and billing is enabled
   - Run: `gcloud config set project pashabook-dev`

2. **Cloud Build fails**
   - Enable Cloud Build API manually if needed
   - Check service account permissions

3. **Firebase authentication errors**
   - Verify Email/Password is enabled in Firebase Console
   - Check that API keys are correctly copied to mobile/.env

4. **Mobile app can't connect to backend**
   - Verify backend URL in mobile/.env
   - Check that Cloud Run service is deployed and accessible
   - Test with: `curl <backend-url>/health`

## Resources

- GCP Console: https://console.cloud.google.com/
- Firebase Console: https://console.firebase.google.com/
- Expo Documentation: https://docs.expo.dev/
- Terraform GCP Provider: https://registry.terraform.io/providers/hashicorp/google/latest/docs
