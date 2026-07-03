# Root variables. No language/instance variable exists here — the
# ar/zh split lives entirely in local.instances (locals.tf) and is threaded
# through module for_each, per issue #11's AC: "one Terraform variable per
# service instance is the only source driving that instance's sidecar image
# reference and LANGUAGE env var" (docs/decisions/language-module-architecture.md
# §5.1, dual-instance amendment).

variable "gcp_project_id" {
  type        = string
  description = "GCP project hosting Cloud Run, Artifact Registry, Secret Manager, and WIF. TBD — no project has been created yet (issue #11 is authoring + plan only); set at the real-apply keys checkpoint."
  default     = null

  validation {
    condition     = var.gcp_project_id == null || can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.gcp_project_id))
    error_message = "gcp_project_id must be a valid GCP project id (lowercase letters, digits, hyphens, 6-30 chars) or null."
  }
}

variable "gcp_region" {
  type        = string
  description = "GCP region for Cloud Run, Artifact Registry, and Secret Manager. Single-region walking skeleton — no multi-region requirement yet."
  default     = "us-central1"
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account id that owns the Pages project and the lexercon.com zone."
  default     = null
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Cloudflare zone id for lexercon.com (registered 2026-07, zone on Cloudflare per the hosting ADR's lexercon.com amendment)."
  default     = null
}

variable "cloudflare_api_token" {
  type        = string
  description = "Cloudflare API token (Zone:DNS:Edit, Zone:Firewall Services:Edit, Account:Cloudflare Pages:Edit scopes). Never committed — supplied via TF_VAR_cloudflare_api_token or an uncommitted *.auto.tfvars at apply time. Part of PR2's keys checkpoint."
  default     = null
  sensitive   = true
}

variable "github_repository" {
  type        = string
  description = "owner/repo used to scope the WIF attribute_condition to GitHub Actions runs from this repo only."
  default     = "julianken/language-agent"
}
