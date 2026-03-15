#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Pashabook GCP Setup                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Authenticate
echo -e "${BLUE}Step 1: Authenticating with GCP${NC}"
echo "Opening browser for authentication..."
gcloud auth login

echo ""
echo -e "${GREEN}✓ Authentication successful${NC}"
echo ""

# Step 2: List projects
echo -e "${BLUE}Step 2: Available Projects${NC}"
gcloud projects list

echo ""
echo -e "${YELLOW}Please enter your GCP Project ID:${NC}"
read -p "Project ID: " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: Project ID cannot be empty${NC}"
    exit 1
fi

# Step 3: Set project
echo ""
echo -e "${BLUE}Step 3: Setting active project${NC}"
gcloud config set project $PROJECT_ID
echo -e "${GREEN}✓ Active project set to: $PROJECT_ID${NC}"

# Step 4: Enable Application Default Credentials
echo ""
echo -e "${BLUE}Step 4: Setting up Application Default Credentials${NC}"
echo "This is required for Terraform and local development..."
gcloud auth application-default login

echo ""
echo -e "${GREEN}✓ Application Default Credentials configured${NC}"

# Step 5: Check billing
echo ""
echo -e "${BLUE}Step 5: Checking Billing${NC}"
BILLING_ENABLED=$(gcloud beta billing projects describe $PROJECT_ID --format="value(billingEnabled)" 2>/dev/null || echo "false")

if [ "$BILLING_ENABLED" = "True" ]; then
    echo -e "${GREEN}✓ Billing is enabled${NC}"
else
    echo -e "${YELLOW}⚠ Billing is not enabled${NC}"
    echo "Please enable billing at:"
    echo "https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID"
    echo ""
    read -p "Press Enter once billing is enabled..."
fi

# Step 6: Save configuration
echo ""
echo -e "${BLUE}Step 6: Saving Configuration${NC}"
echo "export GCP_PROJECT_ID=$PROJECT_ID" > .env.gcp
echo -e "${GREEN}✓ Configuration saved to infra/.env.gcp${NC}"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Setup Complete!                    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo "To use this configuration in your shell, run:"
echo -e "${YELLOW}source infra/.env.gcp${NC}"
echo ""
echo "Next step: Run the deployment script"
echo -e "${YELLOW}./infra/deploy.sh${NC}"
echo ""
