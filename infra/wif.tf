# Keyless CI deploy via Workload Identity Federation. GitHub Actions on this
# repo's `main` branch mints a short-lived GCP token by exchanging its OIDC
# token — NO service-account JSON key is ever created, committed, or stored.
# Mirrors violin-scales/infra/wif.tf near-verbatim (that repo's own
# storage-only precedent), widened to the roles this deploy actually needs:
# build+push images and roll both Cloud Run services forward.

data "google_project" "this" {
  project_id = var.gcp_project_id
}

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.gcp_project_id
  workload_identity_pool_id = "github-actions-pool"
  display_name              = "GitHub Actions pool"
  description               = "WIF pool for keyless GitHub Actions deploys (language-agent)."
}

# attribute_condition is the security boundary: only tokens from this exact
# repo, on the main branch, may assume the deploy SA.
resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.gcp_project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-actions-provider"
  display_name                       = "GitHub Actions OIDC"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  attribute_condition = "assertion.repository=='${var.github_repository}' && assertion.ref=='refs/heads/main'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account" "deploy" {
  project      = var.gcp_project_id
  account_id   = "gha-deploy"
  display_name = "GitHub Actions deploy (language-agent)"
  description  = "Keyless WIF deploy SA — builds/pushes the server + both sidecar images and rolls both Cloud Run services forward."
}

resource "google_project_iam_member" "deploy_run_admin" {
  project = var.gcp_project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_project_iam_member" "deploy_artifact_writer" {
  project = var.gcp_project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# run.admin can update a service's revision, but Cloud Run also requires the
# deployer to be able to act AS the per-instance runtime service accounts
# (google_cloud_run_v2_service.template.service_account in the
# cloud-run-service module) when rolling out a new revision.
resource "google_project_iam_member" "deploy_sa_user" {
  project = var.gcp_project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# Let any GitHub Actions run from THIS repo's main branch impersonate the
# deploy SA. The principalSet is scoped by attribute.repository (further
# narrowed to main by the provider's attribute_condition above) and uses the
# project NUMBER, not the project id.
resource "google_service_account_iam_member" "deploy_wif" {
  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/projects/${data.google_project.this.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github.workload_identity_pool_id}/attribute.repository/${var.github_repository}"
}
