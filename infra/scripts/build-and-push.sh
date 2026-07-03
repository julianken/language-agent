#!/usr/bin/env bash
# Builds + pushes the three images this deploy needs to Artifact Registry
# (issue #11 PR2 — the live deploy). AUTHORED ONLY — never run by this PR:
# `docker build`/`docker push` are real-registry mutations, forbidden under
# PR2's zero-cloud-mutation constraint (author + validate + `terraform plan`
# only). The orchestrator runs this, with the live keys, at the real deploy.
#
# Images (repo path from infra/registry.tf's google_artifact_registry_repository
# "images", region-scoped per infra/locals.tf's artifact_registry_host):
#
#   <region>-docker.pkg.dev/<project>/language-agent/server:<tag>       (infra/docker/server.Dockerfile, build context = REPO ROOT)
#   <region>-docker.pkg.dev/<project>/language-agent/sidecar-ar:<tag>   (src/sidecars/ar/Dockerfile,     build context = src/sidecars/ar)
#   <region>-docker.pkg.dev/<project>/language-agent/sidecar-zh:<tag>   (src/sidecars/zh/Dockerfile,     build context = src/sidecars/zh)
#
# Tag convention: every image is pushed under BOTH a content-addressable tag
# (short git SHA by default — TAG overrides) AND `:latest`. Terraform's
# server_image / sidecar_image (infra/locals.tf) reference `:latest`
# exclusively — that's what a first `terraform apply` deploys. After the
# first deploy, `google_cloud_run_v2_service.this`'s `lifecycle.ignore_changes`
# (infra/modules/cloud-run-service/main.tf) means Terraform will NOT notice
# a freshly re-pushed `:latest` digest on its own — re-pushing `:latest`
# alone does not roll a new Cloud Run revision forward. That's `AGENTS.md`'s
# deploy runbook's job (a `gcloud run services update ... --image=...:latest`
# per instance, or a real CI/CD workflow — owed, not built by this issue),
# not this script's.
#
# Auth: keyless — `gcloud auth configure-docker` wires Docker's credential
# helper to the operator's already-authenticated `gcloud` identity (or, in
# CI, the WIF-impersonated deploy SA from infra/wif.tf). No service-account
# JSON key is created, read, or referenced here.
#
# Usage:
#   GCP_PROJECT_ID=language-agent-prod GCP_REGION=us-central1 \
#     infra/scripts/build-and-push.sh
#
# Env:
#   GCP_PROJECT_ID  required — the real GCP project id (infra/variables.tf's
#                   gcp_project_id; e.g. language-agent-prod).
#   GCP_REGION      default us-central1 (infra/variables.tf's gcp_region
#                   default).
#   TAG             default: `git rev-parse --short HEAD`. The extra
#                   content-addressable tag pushed alongside `:latest`.
set -euo pipefail

root="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
cd "$root"

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID (the real language-agent GCP project id — see infra/variables.tf)}"
region="${GCP_REGION:-us-central1}"
tag="${TAG:-$(git rev-parse --short HEAD)}"
registry="${region}-docker.pkg.dev/${GCP_PROJECT_ID}/language-agent"

echo "== gcloud docker auth (keyless) =="
gcloud auth configure-docker "${region}-docker.pkg.dev" --quiet

build_and_push() {
  local name="$1" dockerfile="$2" context="$3"
  local ref="${registry}/${name}"
  echo "== building ${ref}:${tag} (and :latest) from ${dockerfile}, context ${context} =="
  docker build \
    -f "$dockerfile" \
    -t "${ref}:${tag}" \
    -t "${ref}:latest" \
    "$context"
  echo "== pushing ${ref}:${tag} =="
  docker push "${ref}:${tag}"
  echo "== pushing ${ref}:latest =="
  docker push "${ref}:latest"
}

build_and_push "server" "infra/docker/server.Dockerfile" "."
build_and_push "sidecar-ar" "src/sidecars/ar/Dockerfile" "src/sidecars/ar"
build_and_push "sidecar-zh" "src/sidecars/zh/Dockerfile" "src/sidecars/zh"

echo "done — pushed to ${registry}/{server,sidecar-ar,sidecar-zh}:{${tag},latest}"
echo "next: 'terraform apply' (first deploy) or, to roll an EXISTING service"
echo "forward onto the freshly pushed :latest digest (each container updated"
echo "independently via --container, per the cloud-run-service module's"
echo "container names \"server\"/\"sidecar\"):"
echo "  gcloud run services update la-<ar|zh> --project=\"$GCP_PROJECT_ID\" \\"
echo "    --region=\"$region\" --container=server --image=${registry}/server:latest"
echo "  gcloud run services update la-<ar|zh> --project=\"$GCP_PROJECT_ID\" \\"
echo "    --region=\"$region\" --container=sidecar --image=${registry}/sidecar-<ar|zh>:latest"
