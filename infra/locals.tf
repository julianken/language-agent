# The single source of truth for the dual-instance topology. Every module
# below is instantiated with `for_each = local.instances` — this map, not a
# `lang === "ar"` conditional anywhere in code, is what differentiates the
# two deployments (docs/decisions/language-module-architecture.md §5.1 +
# hosting ADR's "Amendment — dual-instance topology"). Adding a third
# instance would mean adding one entry here, not touching module source.
#
# readyz_period_seconds / readyz_failure_threshold are sized from each
# sidecar's own measured warmup (src/sidecars/{ar,zh}/README.md), NOT a
# shared guess:
#   - ar:  README documents "container start → /readyz 200 ≈ 2 s"
#          (CAMeL morphology-db load). period=2s, failure_threshold=3
#          covers up to 6s of true warmup — margin above the measured ~2s
#          for image-pull-dominated cold starts.
#   - zh:  README documents "~1.2-1.3 s container start → first /readyz 200
#          (no model load)". Cloud Run's startup_probe period_seconds is
#          integer-only, so 1.2-1.3s warmup is served by the finer 1s
#          granularity: period=1s, failure_threshold=2 covers up to 2s —
#          margin above the measured ~1.3s, and deliberately NOT a copy of
#          ar's numbers (issue #11 AC: "two distinct probe configs, not one
#          shared value").
locals {
  instances = {
    ar = {
      language                 = "ar"
      frontend_domain          = "lexercon.com"
      api_domain               = "api.lexercon.com"
      sidecar_image_repo       = "sidecar-ar"
      readyz_period_seconds    = 2
      readyz_failure_threshold = 3
    }
    zh = {
      language                 = "zh"
      frontend_domain          = "zh.lexercon.com"
      api_domain               = "zh-api.lexercon.com"
      sidecar_image_repo       = "sidecar-zh"
      readyz_period_seconds    = 1
      readyz_failure_threshold = 2
    }
  }

  # One Artifact Registry host for both instances' sidecar images plus the
  # single shared server image (no per-language server image — the ADR's
  # registry-lazy-import model means the unselected pack never loads either
  # way, so one image serves both Cloud Run services).
  artifact_registry_host = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/language-agent"
  server_image           = "${local.artifact_registry_host}/server:latest"
}
