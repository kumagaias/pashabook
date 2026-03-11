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

output "worker_url" {
  description = "URL of the Cloud Run worker service"
  value       = module.pashabook.worker_url
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
