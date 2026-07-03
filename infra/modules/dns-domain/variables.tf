variable "cloudflare_zone_id" {
  type        = string
  description = "Cloudflare zone id for lexercon.com."
}

variable "zone_apex" {
  type        = string
  description = "The apex domain of the Cloudflare zone, used to compute the DNS record label from api_domain."
  default     = "lexercon.com"
}

variable "api_domain" {
  type        = string
  description = "This instance's API domain — api.lexercon.com (ar) or zh-api.lexercon.com (zh). Both single-level labels under the zone (Cloudflare Universal SSL covers only *.lexercon.com)."
}

variable "gcp_project_id" {
  type        = string
  description = "GCP project id (google_cloud_run_domain_mapping metadata.namespace)."
}

variable "gcp_region" {
  type        = string
  description = "GCP region matching the target Cloud Run service's location."
}

variable "cloud_run_service_name" {
  type        = string
  description = "The Cloud Run service name this instance's API domain maps to (from module.cloud_run_service[key].service_name)."
}
