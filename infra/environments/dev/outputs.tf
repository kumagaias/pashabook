output "storage_bucket_uploads" {
  description = "Name of the Cloud Storage bucket for uploads"
  value       = module.pashabook.storage_bucket_uploads
}

output "storage_bucket_videos" {
  description = "Name of the Cloud Storage bucket for videos"
  value       = module.pashabook.storage_bucket_videos
}

output "storage_bucket_audio" {
  description = "Name of the Cloud Storage bucket for audio"
  value       = module.pashabook.storage_bucket_audio
}

output "storage_bucket_images" {
  description = "Name of the Cloud Storage bucket for images"
  value       = module.pashabook.storage_bucket_images
}

output "storage_bucket_functions_source" {
  description = "Name of the Cloud Storage bucket for functions source code"
  value       = module.pashabook.storage_bucket_functions_source
}

output "cloud_run_url" {
  description = "URL of the Cloud Run worker service"
  value       = module.pashabook.cloud_run_url
}

output "tasks_queue_name" {
  description = "Name of the Cloud Tasks queue"
  value       = module.pashabook.tasks_queue_name
}

output "service_account_email" {
  description = "Email of the backend service account"
  value       = module.pashabook.service_account_email
}

output "artifact_registry_repository" {
  description = "Name of the Artifact Registry repository"
  value       = module.pashabook.artifact_registry_repository
}

output "artifact_registry_location" {
  description = "Location of the Artifact Registry repository"
  value       = module.pashabook.artifact_registry_location
}

output "workload_identity_provider" {
  description = "Workload Identity Provider for GitHub Actions"
  value       = module.pashabook.workload_identity_provider
}

output "github_actions_service_account_email" {
  description = "Service account email for GitHub Actions"
  value       = module.pashabook.github_actions_service_account_email
}

output "firebase_service_account_key" {
  description = "Firebase Hosting deployer service account key (base64 encoded JSON)"
  value       = module.pashabook.firebase_service_account_key
  sensitive   = true
}
