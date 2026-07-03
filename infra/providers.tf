# Provider configuration. No resource enablement here — the walking skeleton
# doesn't pre-enable APIs via a mutating google_project_service resource
# (issue #11 is authoring + plan only; enabling APIs is a mutation deferred to
# the real apply at the keys checkpoint).
provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
