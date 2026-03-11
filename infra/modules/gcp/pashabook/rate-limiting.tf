# Rate limiting for Cloud Run using Cloud Armor
# Prevents infinite loop attacks and excessive API usage

resource "google_compute_security_policy" "rate_limit" {
  name        = "pashabook-rate-limit"
  description = "Rate limiting policy to prevent infinite polling loops"

  # Rule 1: Rate limit per IP address
  rule {
    action   = "throttle"
    priority = 1000

    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }

    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"

      enforce_on_key = "IP"

      rate_limit_threshold {
        count        = 100  # Max 100 requests
        interval_sec = 60   # Per 60 seconds (1 minute)
      }
    }

    description = "Limit to 100 requests per minute per IP"
  }

  # Rule 2: Default allow
  rule {
    action   = "allow"
    priority = 2147483647
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow rule"
  }
}

# Note: Cloud Armor requires Load Balancer
# For Cloud Run direct access, use application-level rate limiting instead
# This file is for reference - actual implementation should be in Express middleware
