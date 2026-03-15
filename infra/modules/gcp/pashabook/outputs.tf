output "cloud_run_url" {
  description = "Cloud Run service URL"
  value       = google_cloud_run_service.worker.status[0].url
}

output "artifact_registry_repository" {
  description = "Artifact Registry repository URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${var.artifact_registry_repository_id}"
}

output "workload_identity_provider" {
  description = "Workload Identity Provider for GitHub Actions"
  value       = google_iam_workload_identity_pool_provider.github_actions.name
}

output "github_actions_service_account_email" {
  description = "Service account email for GitHub Actions"
  value       = google_service_account.github_actions.email
}

output "storage_bucket_uploads" {
  description = "Name of the Cloud Storage bucket for uploads"
  value       = google_storage_bucket.uploads.name
}

output "storage_bucket_videos" {
  description = "Name of the Cloud Storage bucket for videos"
  value       = google_storage_bucket.videos.name
}

output "storage_bucket_audio" {
  description = "Name of the Cloud Storage bucket for audio"
  value       = google_storage_bucket.audio.name
}

output "storage_bucket_images" {
  description = "Name of the Cloud Storage bucket for images"
  value       = google_storage_bucket.images.name
}

output "storage_bucket_functions_source" {
  description = "Name of the Cloud Storage bucket for functions source"
  value       = google_storage_bucket.functions_source.name
}

output "tasks_queue_name" {
  description = "Name of the Cloud Tasks queue"
  value       = google_cloud_tasks_queue.processing_queue.name
}

output "service_account_email" {
  description = "Email of the backend service account"
  value       = google_service_account.backend.email
}

output "artifact_registry_location" {
  description = "Location of the Artifact Registry repository"
  value       = var.region
}

output "firebase_service_account_key" {
  description = "Firebase Hosting deployer service account key (base64 encoded JSON)"
  value       = google_service_account_key.firebase_deployer.private_key
  sensitive   = true
}

