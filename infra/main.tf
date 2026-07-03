# Wires the four modules together, each for_each-instantiated over
# local.instances — this is the "existing module for_each-instantiated over
# ["ar","zh"] rather than hand-duplicated" AC (issue #11, hosting ADR's
# dual-instance amendment). No module block below contains an "ar" or "zh"
# literal; every per-instance value flows from local.instances.

module "access_gate" {
  source = "./modules/access-gate"

  for_each = local.instances

  instance_key       = each.key
  cloudflare_zone_id = var.cloudflare_zone_id
  api_domain         = each.value.api_domain
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

module "dns_domain" {
  source = "./modules/dns-domain"

  for_each = local.instances

  cloudflare_zone_id     = var.cloudflare_zone_id
  api_domain             = each.value.api_domain
  gcp_project_id         = var.gcp_project_id
  gcp_region             = var.gcp_region
  cloud_run_service_name = module.cloud_run_service[each.key].service_name
}

# Single Pages project — NOT for_each'd (one project, two custom domains).
module "frontend_pages" {
  source = "./modules/frontend-pages"

  cloudflare_account_id = var.cloudflare_account_id
  cloudflare_zone_id    = var.cloudflare_zone_id
  instances             = local.instances
}
