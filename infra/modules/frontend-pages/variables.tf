variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account id owning the Pages project."
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Cloudflare zone id for the apex zone (lexercon.com)."
}

variable "zone_apex" {
  type        = string
  description = "The apex domain of the Cloudflare zone. Used to compute each instance's DNS record label relative to the zone (\"@\" for the apex itself, the subdomain label otherwise)."
  default     = "lexercon.com"
}

variable "instances" {
  description = "local.instances from the root module — this module reads frontend_domain and api_domain per instance to build the host->origin config map and the per-instance custom domain + DNS record. Single Pages project, N custom domains — not N Pages projects."
  type = map(object({
    frontend_domain = string
    api_domain      = string
  }))
}
