# Provider + Terraform version constraints (issue #11, per the hosting ADR:
# docs/decisions/hosting-walking-skeleton.md — "IaC | Terraform, one tree,
# google + cloudflare providers · GCS remote state · WIF/GitHub-OIDC"). Version
# pins mirror the operator's sibling repos already running these providers in
# production (bird-watch's google ~> 7.30 / cloudflare ~> 4.20). No `random`
# provider: every secret this tree declares (the per-instance shared secrets,
# the shared Anthropic key) is a `google_secret_manager_secret` CONTAINER
# whose value is generated out-of-band (`openssl rand` / a real credential
# supplied at apply time) — there is no `random_*` resource anywhere in this
# tree to justify pinning it (PR #40 review SUGGESTION, folded here in PR2).
#
# `terraform init -backend=false` (or a local-backend override — see
# infra/README.md) skips the GCS backend below entirely, so `terraform
# validate` runs without a bucket existing yet. The bucket is NAMED here but
# created out-of-band before the first real `terraform init`, exactly like
# violin-scales' backend.tf documents.
terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.30"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.20"
    }
  }

  backend "gcs" {
    bucket = "language-agent-tfstate"
    prefix = "terraform/state"
  }
}
