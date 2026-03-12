terraform {
  required_version = ">= 1.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

module "pashabook" {
  source = "../../modules/gcp/pashabook"

  project_id                      = var.project_id
  region                          = var.region
  environment                     = "dev"
  firestore_location              = var.firestore_location
  artifact_registry_repository_id = var.artifact_registry_repository_id
  force_destroy_buckets           = var.force_destroy_buckets
  bucket_lifecycle_age_days       = var.bucket_lifecycle_age_days
  tasks_max_concurrent_dispatches = var.tasks_max_concurrent_dispatches
  tasks_max_dispatches_per_second = var.tasks_max_dispatches_per_second
  cloud_run_cpu                   = var.cloud_run_cpu
  cloud_run_memory                = var.cloud_run_memory
  cloud_run_max_instances         = var.cloud_run_max_instances
  cloud_run_min_instances         = var.cloud_run_min_instances
  worker_image                    = var.worker_image
  github_repository               = var.github_repository
}
