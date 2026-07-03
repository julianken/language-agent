# One Artifact Registry repository hosts the single shared server image plus
# both instances' sidecar images (image identity, not repository count, is
# what's per-instance — see locals.tf's artifact_registry_host).
resource "google_artifact_registry_repository" "images" {
  project       = var.gcp_project_id
  location      = var.gcp_region
  repository_id = "language-agent"
  format        = "DOCKER"
  description   = "Server image (shared) + per-instance sidecar images (sidecar-ar, sidecar-zh)."
}
