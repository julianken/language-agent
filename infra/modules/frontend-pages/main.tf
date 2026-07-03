# ONE Cloudflare Pages project serving BOTH instances, with two custom
# domains and a build-time host->API-origin config map — per the hosting
# ADR's dual-instance amendment: "both frontends ship from the single Pages
# project with two custom domains and a build-time host→API-origin config
# map — composition config, not a lang===/language=== conditional in
# engine code." This module deliberately creates exactly one
# cloudflare_pages_project regardless of how many entries var.instances has.

resource "cloudflare_pages_project" "frontend" {
  account_id        = var.cloudflare_account_id
  name              = "language-agent"
  production_branch = "main"

  deployment_configs {
    production {
      environment_variables = {
        # A single JSON map the frontend build bakes in and reads by
        # `window.location.hostname` at runtime — composition config, no
        # per-language conditional. Consumed by the (not-yet-built) frontend
        # deploy step; authoring it here is what proves this AC ahead of
        # that build existing.
        HOST_API_ORIGIN_MAP = jsonencode({
          for key, inst in var.instances : inst.frontend_domain => "https://${inst.api_domain}"
        })
      }
    }
  }
}

# One custom-domain binding per instance on the single project above.
resource "cloudflare_pages_domain" "custom" {
  for_each = var.instances

  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.frontend.name
  domain       = each.value.frontend_domain
}

# cloudflare_pages_domain binds the domain on the Pages side but does not
# create the DNS record itself (bird-watch's frontend.tf precedent) — without
# this the zone serves NXDOMAIN for each custom domain. proxied=true lets CF
# auto-flatten the apex CNAME for the ar instance (lexercon.com itself).
resource "cloudflare_record" "frontend_cname" {
  for_each = var.instances

  zone_id = var.cloudflare_zone_id
  name    = each.value.frontend_domain == var.zone_apex ? "@" : trimsuffix(each.value.frontend_domain, ".${var.zone_apex}")
  type    = "CNAME"
  content = cloudflare_pages_project.frontend.subdomain
  proxied = true
  ttl     = 1
}
