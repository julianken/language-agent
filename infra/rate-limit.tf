# ── Consolidated edge rate-limit ruleset (access gate, Layer 1) ──────────
# Cloudflare constraints that shaped this (both discovered at apply against
# the real Free-plan lexercon.com zone):
#   1. ONE ruleset per zone per phase (http_ratelimit) — so this is a single
#      root resource, not the per-instance one the access-gate module first
#      tried (err 20217: "exceeded maximum number of zone rulesets").
#   2. The Free plan allows exactly ONE rule in the http_ratelimit phase
#      (err 50001: "2 out of 1") — so the two instances' API domains are one
#      rule with an OR expression, NOT two rules. (Advanced Rate Limiting /
#      more rules is a paid feature; the load-bearing access gate is anyway
#      Layer 2, the per-instance server-side shared secret, which also
#      protects the direct run.app URL that an edge rule can't.)
# Both facts are derived from local.instances — no "ar"/"zh" literal here.
resource "cloudflare_ruleset" "api_rate_limit" {
  zone_id     = var.cloudflare_zone_id
  name        = "language-agent-api-rate-limit"
  description = "Access-gate rate limit for both instances' API domains (issue #11)"
  kind        = "zone"
  phase       = "http_ratelimit"

  rules {
    description = "Rate limit all requests to the language-agent API domains"
    # One rule, OR over every instance's api_domain (Free-plan 1-rule limit).
    expression = "(${join(" or ", [for inst in local.instances : "http.host eq \"${inst.api_domain}\""])})"
    action     = "block"
    enabled    = true

    ratelimit {
      # cf.colo.id is REQUIRED by the Cloudflare API in characteristics
      # (rate limiting is enforced at the colo level).
      characteristics     = ["ip.src", "cf.colo.id"]
      period              = 10
      requests_per_period = 10
      mitigation_timeout  = 10
    }

    action_parameters {
      response {
        status_code  = 429
        content      = "{\"error\":\"rate limit exceeded\"}"
        content_type = "application/json"
      }
    }
  }
}
