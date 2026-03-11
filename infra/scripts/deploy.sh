#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Pashabook Infrastructure Deployment  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Function to print step header
print_step() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Step $1: $2${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check prerequisites
print_step "1" "Checking Prerequisites"

if [ -z "$GCP_PROJECT_ID" ]; then
    print_error "GCP_PROJECT_ID environment variable is not set"
    echo "Please set it with: export GCP_PROJECT_ID=your-project-id"
    exit 1
fi
print_success "GCP_PROJECT_ID: $GCP_PROJECT_ID"

if [ -z "$GCP_REGION" ]; then
    GCP_REGION="asia-northeast1"
    print_warning "GCP_REGION not set, using default: $GCP_REGION"
fi
print_success "GCP_REGION: $GCP_REGION"

if ! command -v gcloud &> /dev/null; then
    print_error "gcloud CLI is not installed"
    echo "Install with: brew install google-cloud-sdk"
    exit 1
fi
print_success "gcloud CLI installed"

if ! command -v terraform &> /dev/null; then
    print_error "terraform is not installed"
    echo "Install with: brew install terraform"
    exit 1
fi
print_success "terraform installed"

if ! command -v docker &> /dev/null; then
    print_error "docker is not installed"
    echo "Install with: brew install docker"
    exit 1
fi
print_success "docker installed"

if ! command -v firebase &> /dev/null; then
    print_warning "firebase CLI is not installed"
    echo "Installing firebase-tools..."
    npm install -g firebase-tools
fi
print_success "firebase CLI installed"

# Authenticate
print_step "2" "Authenticating with GCP"
echo "Checking authentication status..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    print_warning "Not authenticated. Running gcloud auth login..."
    gcloud auth login
fi
print_success "Authenticated with GCP"

gcloud config set project $GCP_PROJECT_ID
print_success "Active project: $GCP_PROJECT_ID"

# Enable billing check
print_step "3" "Checking Billing"
echo "Please ensure billing is enabled for this project:"
echo "https://console.cloud.google.com/billing/linkedaccount?project=$GCP_PROJECT_ID"
read -p "Press Enter to continue once billing is enabled..."

# Initialize Firebase
print_step "4" "Initializing Firebase"
if ! firebase projects:list | grep -q "$GCP_PROJECT_ID"; then
    print_warning "Firebase not initialized for this project"
    echo "Initializing Firebase..."
    firebase projects:addfirebase $GCP_PROJECT_ID || true
fi
firebase use $GCP_PROJECT_ID
print_success "Firebase project configured"

# Build Docker image
print_step "5" "Building Docker Image"
cd ../backend
print_warning "Building Cloud Run worker image (this may take several minutes)..."
gcloud builds submit --tag $GCP_REGION-docker.pkg.dev/$GCP_PROJECT_ID/pashabook/backend:latest
print_success "Docker image built and pushed"
cd ../infra

# Package Cloud Functions
print_step "6" "Packaging Cloud Functions"
print_warning "Cloud Functions are no longer used - skipping"
print_success "Skipped (using Cloud Run only)"

# Deploy Terraform infrastructure
print_step "7" "Deploying Infrastructure with Terraform"
cd environments/dev

if [ ! -f terraform.tfvars ]; then
    print_warning "Creating terraform.tfvars from example..."
    cp terraform.tfvars.example terraform.tfvars
    sed -i '' "s/your-project-id/$GCP_PROJECT_ID/g" terraform.tfvars
fi

terraform init
print_success "Terraform initialized"

terraform plan -out=tfplan
print_success "Terraform plan created"

terraform apply tfplan
print_success "Infrastructure deployed"

cd ../..

# Upload Functions source
print_step "8" "Uploading Cloud Functions Source"
print_warning "Cloud Functions are no longer used - skipping"
print_success "Skipped (using Cloud Run only)"

# Redeploy functions with source code
print_step "9" "Redeploying Cloud Functions"
print_warning "Cloud Functions are no longer used - skipping"
print_success "Skipped (using Cloud Run only)"

# Deploy Firebase rules
print_step "10" "Deploying Firebase Rules"
cd infra
firebase deploy --only firestore:rules,storage --project $GCP_PROJECT_ID
print_success "Firebase rules deployed"
cd ..

# Enable Firebase Authentication
print_step "11" "Configuring Firebase Authentication"
print_warning "Manual step required:"
echo "1. Go to: https://console.firebase.google.com/project/$GCP_PROJECT_ID/authentication/providers"
echo "2. Enable 'Email/Password' authentication"
read -p "Press Enter once you've enabled Email/Password authentication..."
print_success "Firebase Authentication configured"

# Generate mobile app config
print_step "12" "Generating Mobile App Configuration"
cd environments/dev
WORKER_URL=$(terraform output -raw worker_url)
cd ../..

echo ""
print_success "Deployment Complete!"
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Next Steps                     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo "1. Get Firebase config from:"
echo "   https://console.firebase.google.com/project/$GCP_PROJECT_ID/settings/general"
echo ""
echo "2. Create mobile/.env with:"
echo "   EXPO_PUBLIC_API_URL=$WORKER_URL"
echo "   EXPO_PUBLIC_FIREBASE_API_KEY=<from Firebase console>"
echo "   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=$GCP_PROJECT_ID.firebaseapp.com"
echo "   EXPO_PUBLIC_FIREBASE_PROJECT_ID=$GCP_PROJECT_ID"
echo "   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=$GCP_PROJECT_ID.appspot.com"
echo "   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<from Firebase console>"
echo "   EXPO_PUBLIC_FIREBASE_APP_ID=<from Firebase console>"
echo ""
echo "3. Run the mobile app:"
echo "   cd mobile && npm install && npx expo start"
echo ""
echo -e "${YELLOW}API Endpoint:${NC}"
echo "   Worker:  $WORKER_URL"
echo ""
