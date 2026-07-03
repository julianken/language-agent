# Multicontainer Cloud Run v2 service: the Node/TS SSE server (ingress
# container) + this instance's Python verification sidecar as a second
# container, localhost networking, one deploy unit — per
# docs/decisions/hosting-walking-skeleton.md ("one Cloud Run service with the
# sidecar as a second container ... no cross-service auth"). Adapted from the
# single-container google_cloud_run_v2_service shape in the operator's
# bird-watch/infra/terraform/modules/cloud-run-service module.
#
# Instantiated once per entry in local.instances (root main.tf's
# for_each = local.instances) — this file itself contains no "ar"/"zh"
# literal; instance_key + sidecar_image are the only inputs that vary.

resource "google_service_account" "runtime" {
  account_id   = "la-${var.instance_key}-run"
  display_name = "language-agent ${var.instance_key} Cloud Run runtime"
  project      = var.gcp_project_id
}

# The runtime SA may read exactly its own instance's shared secret — never
# the other instance's (distinct-secret, no-cross-instance-access AC).
resource "google_secret_manager_secret_iam_member" "shared_secret_accessor" {
  project   = var.gcp_project_id
  secret_id = var.shared_secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_cloud_run_v2_service" "this" {
  name     = "la-${var.instance_key}"
  location = var.location
  project  = var.gcp_project_id

  template {
    service_account = google_service_account.runtime.email

    scaling {
      min_instance_count = var.min_instance_count
      max_instance_count = var.max_instance_count
    }

    # ── Ingress container: the Node/TS SSE server. Shared image across both
    #    instances — LANGUAGE is the only thing that differs.
    containers {
      name  = "server"
      image = var.server_image

      ports {
        container_port = var.server_port
      }

      env {
        name  = "LANGUAGE"
        value = var.instance_key
      }

      env {
        name = "SHARED_SECRET"
        value_source {
          secret_key_ref {
            secret  = var.shared_secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "SIDECAR_URL"
        value = "http://localhost:${var.sidecar_port}"
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      depends_on = ["sidecar"]
    }

    # ── Sidecar container: this instance's verification gate. Never
    #    receives ingress traffic (no route to it outside localhost); its
    #    own startup_probe on /readyz gates when the server container starts
    #    (via the depends_on above), per the two sidecar READMEs' /readyz
    #    contract.
    containers {
      name  = "sidecar"
      image = var.sidecar_image

      ports {
        container_port = var.sidecar_port
      }

      resources {
        limits = {
          cpu    = "1"
          memory = var.sidecar_memory
        }
      }

      startup_probe {
        http_get {
          path = "/readyz"
          port = var.sidecar_port
        }
        period_seconds    = var.readyz_period_seconds
        failure_threshold = var.readyz_failure_threshold
        timeout_seconds   = 1
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  # CD (owed to PR2 — no deploy workflow exists yet) rolls the image tags
  # forward on every push to main; without this, `terraform apply` would
  # revert both containers to the :latest tag pinned above. Mirrors
  # bird-watch's cloud-run-service module rationale verbatim.
  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      template[0].containers[1].image,
    ]
  }

  depends_on = [
    google_secret_manager_secret_iam_member.shared_secret_accessor,
  ]
}

# The API domain's proxied Cloudflare CNAME (infra/modules/dns-domain) points
# at this service; edge WAF/rate-limit rules alone don't protect the direct
# run.app URL (the hosting ADR's access-gate rationale), so allUsers invoker
# is required for the proxy to reach it at all — the shared-secret env above
# is the second, server-side layer of the access gate.
resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.gcp_project_id
  name     = google_cloud_run_v2_service.this.name
  location = google_cloud_run_v2_service.this.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
