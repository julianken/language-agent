# The shared Anthropic API key (issue #11 PR2 — the live deploy). Unlike
# infra/modules/access-gate's per-instance shared_secret (one distinct
# value per ar/zh), this is the SAME key consumed by BOTH instances' server
# containers — one live Anthropic account, no per-language credential.
#
# Declares the SECRET CONTAINER only — never a
# google_secret_manager_secret_version resource. The value is added
# out-of-band, near the real `terraform apply`, via:
#
#   printf '%s' "$ANTHROPIC_API_KEY" | gcloud secrets versions add \
#     anthropic-api-key --project="$GCP_PROJECT_ID" --data-file=-
#
# so the raw key bytes never enter Terraform state or this repo — exactly
# the access-gate module's shared_secret pattern (infra/modules/access-gate
# /main.tf), mirrored here at project scope instead of per-instance.
resource "google_secret_manager_secret" "anthropic_api_key" {
  secret_id = "anthropic-api-key"
  project   = var.gcp_project_id

  replication {
    auto {}
  }
}
