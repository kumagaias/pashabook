# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "firestore.googleapis.com",
    "storage.googleapis.com",
    "cloudfunctions.googleapis.com",
    "run.googleapis.com",
    "cloudtasks.googleapis.com",
    "aiplatform.googleapis.com",
    "texttospeech.googleapis.com",
    "cloudscheduler.googleapis.com",
    "logging.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "firebase.googleapis.com",
    "firebasehosting.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# Artifact Registry repository for Docker images
resource "google_artifact_registry_repository" "pashabook" {
  location      = var.region
  repository_id = var.artifact_registry_repository_id
  description   = "Docker repository for Pashabook backend images"
  format        = "DOCKER"

  depends_on = [google_project_service.required_apis]
}

# Firestore Database
resource "google_firestore_database" "pashabook" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.required_apis]
}

# Cloud Storage buckets
resource "google_storage_bucket" "assets" {
  name          = "${var.project_id}-pashabook-assets"
  location      = var.region
  force_destroy = var.force_destroy_buckets

  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = var.bucket_lifecycle_age_days
    }
    action {
      type = "Delete"
    }
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "PUT", "POST"]
    response_header = ["*"]
    max_age_seconds = 3600
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_storage_bucket" "uploads" {
  name          = "${var.project_id}-pashabook-uploads"
  location      = var.region
  force_destroy = var.force_destroy_buckets

  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = var.bucket_lifecycle_age_days
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_storage_bucket" "videos" {
  name          = "${var.project_id}-pashabook-videos"
  location      = var.region
  force_destroy = var.force_destroy_buckets

  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = var.bucket_lifecycle_age_days
    }
    action {
      type = "Delete"
    }
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD"]
    response_header = ["*"]
    max_age_seconds = 3600
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_storage_bucket" "audio" {
  name          = "${var.project_id}-pashabook-audio"
  location      = var.region
  force_destroy = var.force_destroy_buckets

  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = var.bucket_lifecycle_age_days
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_storage_bucket" "images" {
  name          = "${var.project_id}-pashabook-images"
  location      = var.region
  force_destroy = var.force_destroy_buckets

  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = var.bucket_lifecycle_age_days
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_storage_bucket" "functions_source" {
  name          = "${var.project_id}-functions-source"
  location      = var.region
  force_destroy = var.force_destroy_buckets

  uniform_bucket_level_access = true

  depends_on = [google_project_service.required_apis]
}

# Cloud Tasks queue
resource "google_cloud_tasks_queue" "processing_queue" {
  name     = "${var.environment}-processing"
  location = var.region

  rate_limits {
    max_concurrent_dispatches = var.tasks_max_concurrent_dispatches
    max_dispatches_per_second = var.tasks_max_dispatches_per_second
  }

  retry_config {
    max_attempts = var.tasks_max_attempts
    max_backoff  = var.tasks_max_backoff
    min_backoff  = var.tasks_min_backoff
  }

  depends_on = [google_project_service.required_apis]
}

# Service account
resource "google_service_account" "backend" {
  account_id   = "pashabook-backend"
  display_name = "Pashabook Backend Service Account"
}

# IAM permissions
resource "google_project_iam_member" "backend_permissions" {
  for_each = toset([
    "roles/datastore.user",
    "roles/storage.objectAdmin",
    "roles/cloudtasks.enqueuer",
    "roles/aiplatform.user",
    "roles/logging.logWriter",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.backend.email}"
}

# Cloud Run service
resource "google_cloud_run_service" "worker" {
  name     = "pashabook-worker"
  location = var.region

  template {
    spec {
      service_account_name = google_service_account.backend.email
      
      containers {
        image = var.worker_image != "" ? var.worker_image : "${var.region}-docker.pkg.dev/${var.project_id}/${var.artifact_registry_repository_id}/backend:latest"
        
        resources {
          limits = {
            cpu    = var.cloud_run_cpu
            memory = var.cloud_run_memory
          }
        }

        env {
          name  = "GCP_PROJECT_ID"
          value = var.project_id
        }

        env {
          name  = "GCP_REGION"
          value = var.region
        }

        env {
          name  = "GCP_LOCATION"
          value = var.region
        }

        env {
          name  = "STORAGE_BUCKET_UPLOADS"
          value = google_storage_bucket.uploads.name
        }

        env {
          name  = "STORAGE_BUCKET_VIDEOS"
          value = google_storage_bucket.videos.name
        }

        env {
          name  = "STORAGE_BUCKET_AUDIO"
          value = google_storage_bucket.audio.name
        }

        env {
          name  = "STORAGE_BUCKET_IMAGES"
          value = google_storage_bucket.images.name
        }

        env {
          name  = "TASKS_QUEUE"
          value = google_cloud_tasks_queue.processing_queue.name
        }

        env {
          name  = "VERTEX_AI_LOCATION"
          value = var.region
        }
      }

      timeout_seconds = var.cloud_run_timeout_seconds
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/maxScale" = var.cloud_run_max_instances
        "autoscaling.knative.dev/minScale" = var.cloud_run_min_instances
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [
    google_project_service.required_apis,
    google_artifact_registry_repository.pashabook
  ]

  lifecycle {
    ignore_changes = [
      template[0].spec[0].containers[0].image,
    ]
  }
}

# Cloud Run IAM
resource "google_cloud_run_service_iam_member" "worker_public" {
  service  = google_cloud_run_service.worker.name
  location = google_cloud_run_service.worker.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_service_iam_member" "worker_invoker" {
  service  = google_cloud_run_service.worker.name
  location = google_cloud_run_service.worker.location
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.backend.email}"
}
