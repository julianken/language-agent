# The Cloudflare routing Worker (language-router-gateway plan, Task 8 /
# Group D) — apex router + `/ar` `/zh` path proxy for lexercon.com,
# replacing the split-origin Pages+domain-mapping topology this same
# change tears down in main.tf.
#
# ── Provider-version resource-name decision (verified against the
#    ACTUAL installed provider schema, not just registry docs) ────────
# The cloudflare provider is pinned `~> 4.20` (locked 4.52.8 —
# infra/versions.tf / infra/.terraform.lock.hcl). A first pass against
# the Terraform-registry doc search surfaced only the singular
# `cloudflare_worker_script` / `cloudflare_worker_route` and looked like
# "the v4 names" — but `terraform providers schema -json` against the
# REAL installed 4.52.8 provider shows both a singular AND a plural
# form coexist in this SAME pinned version:
#   cloudflare_worker_script   (DEPRECATED — "removed in the next major
#                                version", per `terraform validate`'s
#                                own warning)
#   cloudflare_workers_script  (not deprecated — schema-IDENTICAL:
#                                same attributes, same block_types,
#                                including plain_text_binding /
#                                secret_text_binding with identical
#                                nested attrs — confirmed by diffing
#                                both resources' schema JSON)
# ...and the same pairing for worker_route/workers_route. So v4.52.8 is
# already mid-migration toward the plural names v5 keeps — using them
# needs NO provider bump (still `~> 4.20`, still 4.52.8 locked) and
# avoids the deprecation warning `cloudflare_worker_script` would emit.
# This is what the plan's own Task 8 Interfaces line already named
# (`cloudflare_workers_script.router` + `cloudflare_workers_route`) —
# the schema check confirms that literal spelling was right, not the
# doc-search-only singular guess. Separately, Workers Static Assets
# (`env.ASSETS`) genuinely does NOT exist on either spelling in this
# provider version (no `assets`/`static_assets` block on either
# resource's schema) — so R-A's core avoidance-of-v5 rationale (no
# ASSETS binding, gateway embedded as one HTML string instead) is
# unaffected by this naming correction. v4.52.8 also has NO standalone
# `cloudflare_worker(s)_secret` resource used here: a Worker secret is
# a nested `secret_text_binding { name, text }` block inside the script
# resource itself (a `cloudflare_workers_secret` resource DOES exist in
# this schema too, but it's for setting a secret independently of the
# script resource's own lifecycle — unneeded here, since both secrets
# are known at the same plan/apply time as the script content).

# ── R-A: the deployed script is ONE self-contained file ──────────────
# router-worker.js is an ES module that `import`s
# gateway-html.generated.js (infra/worker/scripts/embed-gateway-html.mjs
# regenerates the latter from src/apps/router/index.html). But v4.52.8's
# `cloudflare_worker_script.content` is a single opaque string — the
# schema has no multi-file/import-graph support (no `main_module` +
# per-file `bindings`, unlike some other providers' module-upload
# shapes). Rather than adding a build step this worktree can't run
# (AUTHOR + VALIDATE only — no execution beyond `terraform
# fmt`/`validate`), the two files are inlined into ONE script AT
# TERRAFORM-EVALUATION TIME using plain HCL string functions
# (`file()` + `replace()`) — no external process, no null_resource:
#   1. drop the `export` off gateway-html.generated.js's
#      `export const GATEWAY_HTML = "...";` so it becomes a bare
#      top-level `const`,
#   2. drop the `import { GATEWAY_HTML } from
#      "./gateway-html.generated.js";` line from router-worker.js,
#   3. concatenate (1) then (2) into one string.
# `GATEWAY_HTML` is referenced only inside the `fetch()` handler, which
# runs after the whole module has evaluated top-to-bottom — so
# declaration order between the `const` and the function definition
# doesn't matter for correctness; data-before-code here is purely for
# readability of the inlined result.
locals {
  worker_gateway_html_inlined = replace(
    file("${path.module}/worker/gateway-html.generated.js"),
    "export const GATEWAY_HTML",
    "const GATEWAY_HTML",
  )

  worker_router_js_no_import = replace(
    file("${path.module}/worker/router-worker.js"),
    "import { GATEWAY_HTML } from \"./gateway-html.generated.js\";\n",
    "",
  )

  worker_script_content = "${local.worker_gateway_html_inlined}\n\n${local.worker_router_js_no_import}"
}

# ── R-C: per-instance secret values ───────────────────────────────────
# Reads the SAME two Secret Manager secret CONTAINERS
# infra/modules/access-gate/main.tf already declares
# (`language-agent-<instance>-shared-secret`) at the SAME "latest"
# version cloud-run-service/main.tf's `secret_key_ref` already injects
# into each backend's own `SHARED_SECRET` env — so the Worker and each
# backend read the identical per-instance value, cross-provider (a GCP
# data source feeding a Cloudflare secret binding). The value lands
# only in the private GCS-backed Terraform state, never a file in this
# repo.
data "google_secret_manager_secret_version" "ar_shared_secret" {
  secret  = "language-agent-ar-shared-secret"
  project = var.gcp_project_id
  version = "latest"
}

data "google_secret_manager_secret_version" "zh_shared_secret" {
  secret  = "language-agent-zh-shared-secret"
  project = var.gcp_project_id
  version = "latest"
}

# ── R-D: bare-host bindings ────────────────────────────────────────────
# `service_uri` (cloud-run-service module's output, itself
# `google_cloud_run_v2_service.this.uri`) is a full `https://…` URL;
# router-worker.js's route() assigns `env.LA_<SEG>_HOST` straight to
# `target.hostname`, which must be a bare host — `trimprefix` strips the
# scheme.
resource "cloudflare_workers_script" "router" {
  account_id = var.cloudflare_account_id
  name       = "lexercon-router"
  content    = local.worker_script_content
  module     = true

  # Matches infra/worker/wrangler.toml's compatibility_date (kept in
  # sync manually — wrangler.toml is for local `wrangler dev`, this
  # resource is the real deploy path; both read the same
  # router-worker.js source of truth).
  compatibility_date = "2026-07-01"

  plain_text_binding {
    name = "LA_AR_HOST"
    text = trimprefix(module.cloud_run_service["ar"].service_uri, "https://")
  }

  plain_text_binding {
    name = "LA_ZH_HOST"
    text = trimprefix(module.cloud_run_service["zh"].service_uri, "https://")
  }

  secret_text_binding {
    name = "SHARED_SECRET_AR"
    text = data.google_secret_manager_secret_version.ar_shared_secret.secret_data
  }

  secret_text_binding {
    name = "SHARED_SECRET_ZH"
    text = data.google_secret_manager_secret_version.zh_shared_secret.secret_data
  }
}

# The route this script binds to, zone-side — `lexercon.com/*` covers
# both the gateway itself (`/`) and the `/ar/*` `/zh/*` proxied paths;
# router-worker.js's route() is what actually discriminates between
# them, not multiple Cloudflare routes.
resource "cloudflare_workers_route" "router" {
  zone_id     = var.cloudflare_zone_id
  pattern     = "lexercon.com/*"
  script_name = cloudflare_workers_script.router.name
}

# ── R-D: the new apex record the Worker route needs to bind against ──
# A `cloudflare_worker_route` alone does not make the zone resolve — the
# apex still needs *some* DNS record before Cloudflare's edge will
# intercept a request to it at all (the retired frontend_pages module
# used to supply this via its Pages custom-domain CNAME; that's gone).
# This is the standard "Worker on the apex" pattern: a proxied
# placeholder record whose actual content is irrelevant, because
# proxied=true means Cloudflare's edge (where the Worker route matches)
# intercepts the request before it would ever reach this IP — the
# 192.0.2.1 value is TEST-NET-1 (RFC 5737), deliberately non-routable,
# used here only because the record type requires *some* well-formed
# address. If the real apply surfaces a Cloudflare-side requirement this
# doesn't anticipate (e.g. a zone-level "orange-cloud AAAA too" nuance),
# that's a plan-vs-apply discovery for whoever runs the real `terraform
# plan` — flagged here, not guessed around.
resource "cloudflare_record" "apex" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  type    = "A"
  content = "192.0.2.1"
  proxied = true
  ttl     = 1
}
