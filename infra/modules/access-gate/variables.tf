variable "instance_key" {
  type        = string
  description = "\"ar\" or \"zh\" — used only for resource naming (the secret id and ruleset name), never for branching logic in this module."
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Cloudflare zone id for lexercon.com."
}

variable "gcp_project_id" {
  type        = string
  description = "GCP project id for the Secret Manager secret container."
}
