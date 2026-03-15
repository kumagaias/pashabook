#!/bin/bash

set -e

echo "Importing existing GCP resources into Terraform state..."

cd "$(dirname "$0")/../environments/dev"

# Import APIs
echo "Importing API services..."
terraform import 'module.pashabook.google_project_service.required_apis["firestore.googleapis.com"]' pashabook-dev/firestore.googleapis.com
terraform import 'module.pashabook.google_project_service.required_apis["storage.googleapis.com"]' pashabook-dev/storage.googleapis.com
terraform import 'module.pashabook.google_project_service.required_apis["cloudfunctions.googleapis.com"]' pashabook-dev/cloudfunctions.googleapis.com
terraform import 'module.pashabook.google_project_service.required_apis["run.googleapis.com"]' pashabook-dev/run.googleapis.com
terraform import 'module.pashabook.google_project_service.required_apis["cloudtasks.googleapis.com"]' pashabook-dev/cloudtasks.googleapis.com
terraform import 'module.pashabook.google_project_service.required_apis["aiplatform.googleapis.com"]' pashabook-dev/aiplatform.googleapis.com
terraform import 'module.pashabook.google_project_service.required_apis["texttospeech.googleapis.com"]' pashabook-dev/texttospeech.googleapis.com
terraform import 'module.pashabook.google_project_service.required_apis["cloudscheduler.googleapis.com"]' pashabook-dev/cloudscheduler.googleapis.com
terraform import 'module.pashabook.google_project_service.required_apis["logging.googleapis.com"]' pashabook-dev/logging.googleapis.com
terraform import 'module.pashabook.google_project_service.required_apis["artifactregistry.googleapis.com"]' pashabook-dev/artifactregistry.googleapis.com
terraform import 'module.pashabook.google_project_service.required_apis["cloudbuild.googleapis.com"]' pashabook-dev/cloudbuild.googleapis.com

# Import Service Account
echo "Importing service account..."
terraform import module.pashabook.google_service_account.backend projects/pashabook-dev/serviceAccounts/pashabook-backend@pashabook-dev.iam.gserviceaccount.com

# Import IAM bindings
echo "Importing IAM bindings..."
terraform import 'module.pashabook.google_project_iam_member.backend_permissions["roles/datastore.user"]' "pashabook-dev roles/datastore.user serviceAccount:pashabook-backend@pashabook-dev.iam.gserviceaccount.com"
terraform import 'module.pashabook.google_project_iam_member.backend_permissions["roles/storage.objectAdmin"]' "pashabook-dev roles/storage.objectAdmin serviceAccount:pashabook-backend@pashabook-dev.iam.gserviceaccount.com"
terraform import 'module.pashabook.google_project_iam_member.backend_permissions["roles/cloudtasks.enqueuer"]' "pashabook-dev roles/cloudtasks.enqueuer serviceAccount:pashabook-backend@pashabook-dev.iam.gserviceaccount.com"
terraform import 'module.pashabook.google_project_iam_member.backend_permissions["roles/aiplatform.user"]' "pashabook-dev roles/aiplatform.user serviceAccount:pashabook-backend@pashabook-dev.iam.gserviceaccount.com"
terraform import 'module.pashabook.google_project_iam_member.backend_permissions["roles/logging.logWriter"]' "pashabook-dev roles/logging.logWriter serviceAccount:pashabook-backend@pashabook-dev.iam.gserviceaccount.com"

# Import Storage Buckets
echo "Importing storage buckets..."
terraform import module.pashabook.google_storage_bucket.assets pashabook-dev-pashabook-assets
terraform import module.pashabook.google_storage_bucket.uploads pashabook-dev-pashabook-uploads
terraform import module.pashabook.google_storage_bucket.videos pashabook-dev-pashabook-videos
terraform import module.pashabook.google_storage_bucket.audio pashabook-dev-pashabook-audio
terraform import module.pashabook.google_storage_bucket.images pashabook-dev-pashabook-images
terraform import module.pashabook.google_storage_bucket.functions_source pashabook-dev-functions-source

# Import Firestore
echo "Importing Firestore database..."
terraform import module.pashabook.google_firestore_database.pashabook projects/pashabook-dev/databases/\(default\)

# Import Cloud Tasks Queue
echo "Importing Cloud Tasks queue..."
terraform import module.pashabook.google_cloud_tasks_queue.processing_queue projects/pashabook-dev/locations/asia-northeast1/queues/pashabook-processing

# Import Artifact Registry
echo "Importing Artifact Registry repository..."
terraform import module.pashabook.google_artifact_registry_repository.pashabook projects/pashabook-dev/locations/asia-northeast1/repositories/pashabook

# Cloud Run and IAM are already imported

echo "Import complete!"
