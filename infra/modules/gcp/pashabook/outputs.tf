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
  description = "Name of the Cloud Storage bucket for functions source code"
  value       = google_storage_bucket.functions_source.name
}

output "worker_url" {
  description = "URL of the Cloud Run worker service"
  value       = google_cloud_run_service.worker.status[0].url
}

output "tasks_queue_name" {
  description = "Name of the Cloud Tasks queue"
  value       = google_cloud_tasks_queue.processing_queue.name
}

output "service_account_email" {
  description = "Email of the backend service account"
  value       = google_service_account.backend.email
}

output "artifact_registry_repository" {
  description = "Name of the Artifact Registry repository"
  value       = google_artifact_registry_repository.pashabook.name
}

output "artifact_registry_location" {
  description = "Location of the Artifact Registry repository"
  value       = google_artifact_registry_repository.pashabook.location
}
