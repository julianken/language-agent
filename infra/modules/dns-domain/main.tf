# The proxied API CNAME + Cloud Run domain mapping for ONE instance. Called
# once per entry in local.instances from root main.tf (for_each), so this
# file contains no "ar"/"zh" literal — api_domain and cloud_run_service_name
# are the only per-instance inputs.
#
# Subdomain -> CNAME to Cloud Run's documented domain-mapping target.
# Cloud Run rejects requests whose Host header isn't a registered domain
# mapping, so pointing straight at the run.app URL 404s — the canonical path
# is a CNAME to ghs.googlehosted.com plus google_cloud_run_domain_mapping
# below. proxied=true per the hosting ADR's lexercon.com amendment: "the v0
# SSE path is now behind the Cloudflare proxy" — this is what puts it there.
# Mirrors bird-watch/infra/terraform/frontend.tf's api CNAME precedent.
resource "cloudflare_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = trimsuffix(var.api_domain, ".${var.zone_apex}")
  type    = "CNAME"
  content = "ghs.googlehosted.com"
  proxied = true
  ttl     = 1
}

# NOTE: google_cloud_run_domain_mapping is the v1-Knative resource — the v2
# provider (google_cloud_run_v2_service, used by the cloud-run-service
# module) does not expose a domain-mapping resource. The v1/v2 mix is
# intentional here, per bird-watch's frontend.tf precedent. PREREQUISITE
# (out-of-band, before the real apply): the operator must verify api_domain
# in Google Search Console (a one-time TXT record) — this resource fails
# without that, which is exactly why this PR only plans, never applies.
resource "google_cloud_run_domain_mapping" "api" {
  location = var.gcp_region
  name     = var.api_domain

  metadata {
    namespace = var.gcp_project_id
  }

  spec {
    route_name = var.cloud_run_service_name
  }
}
