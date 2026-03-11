variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, stag, prod)"
  type        = string
}

variable "firestore_location" {
  description = "Firestore database location"
  type        = string
  default     = "us-central1"
}

variable "artifact_registry_repository_id" {
  description = "Artifact Registry repository ID"
  type        = string
  default     = "pashabook"
}

variable "force_destroy_buckets" {
  description = "Allow force destroy of storage buckets"
  type        = bool
  default     = false
}

variable "bucket_lifecycle_age_days" {
  description = "Number of days before objects are deleted"
  type        = number
  default     = 1
}

variable "tasks_max_concurrent_dispatches" {
  description = "Maximum concurrent dispatches for Cloud Tasks"
  type        = number
  default     = 3
}

variable "tasks_max_dispatches_per_second" {
  description = "Maximum dispatches per second for Cloud Tasks"
  type        = number
  default     = 1
}

variable "tasks_max_attempts" {
  description = "Maximum retry attempts for Cloud Tasks"
  type        = number
  default     = 3
}

variable "tasks_max_backoff" {
  description = "Maximum backoff time for Cloud Tasks retries"
  type        = string
  default     = "300s"
}

variable "tasks_min_backoff" {
  description = "Minimum backoff time for Cloud Tasks retries"
  type        = string
  default     = "10s"
}

variable "cloud_run_cpu" {
  description = "CPU allocation for Cloud Run"
  type        = string
  default     = "2"
}

variable "cloud_run_memory" {
  description = "Memory allocation for Cloud Run"
  type        = string
  default     = "4Gi"
}

variable "cloud_run_timeout_seconds" {
  description = "Timeout in seconds for Cloud Run"
  type        = number
  default     = 600
}

variable "cloud_run_max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = string
  default     = "10"
}

variable "cloud_run_min_instances" {
  description = "Minimum number of Cloud Run instances"
  type        = string
  default     = "0"
}

variable "worker_image" {
  description = "Docker image for Cloud Run worker (optional)"
  type        = string
  default     = ""
}
