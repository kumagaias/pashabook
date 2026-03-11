# Firebase Hosting site
resource "google_firebase_hosting_site" "pashabook_web" {
  provider = google-beta
  project  = var.project_id
  site_id  = var.firebase_hosting_site_id

  depends_on = [google_project_service.required_apis]
}

# Firebase Hosting release (managed by Firebase CLI)
# This resource is for reference only - actual deployments are done via Firebase CLI
