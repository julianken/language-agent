# Wires the modules together, each for_each-instantiated over
# local.instances — this is the "existing module for_each-instantiated over
# ["ar","zh"] rather than hand-duplicated" AC (issue #11, hosting ADR's
# dual-instance amendment). No module block below contains an "ar" or "zh"
# literal; every per-instance value flows from local.instances.
#
# The split-origin topology (a per-instance "dns_domain" module — proxied
# CNAME + google_cloud_run_domain_mapping — and a single "frontend_pages"
# Pages project with two custom domains) is RETIRED as of the
# language-router-gateway plan (Task 8, R-D): both instances now sit behind
# the ONE lexercon.com apex Worker (worker.tf) at /ar and /zh path routes,
# proxying straight to each Cloud Run service's own run.app URL (Host
# override) — no Cloudflare-side domain per instance, no Google domain
# verification/mapping. See docs/decisions/hosting-walking-skeleton.md's
# "Amendment — apex router" for the full before/after.

module "access_gate" {
  source = "./modules/access-gate"

  for_each = local.instances

  instance_key       = each.key
  cloudflare_zone_id = var.cloudflare_zone_id
  gcp_project_id     = var.gcp_project_id
}

module "cloud_run_service" {
  source = "./modules/cloud-run-service"

  for_each = local.instances

  instance_key             = each.key
  location                 = var.gcp_region
  gcp_project_id           = var.gcp_project_id
  server_image             = local.server_image
  sidecar_image            = "${local.artifact_registry_host}/${each.value.sidecar_image_repo}:latest"
  readyz_period_seconds    = each.value.readyz_period_seconds
  readyz_failure_threshold = each.value.readyz_failure_threshold
  shared_secret_id         = module.access_gate[each.key].shared_secret_id
  anthropic_secret_id      = google_secret_manager_secret.anthropic_api_key.secret_id

  depends_on = [google_artifact_registry_repository.images]
}
