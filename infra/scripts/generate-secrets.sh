#!/usr/bin/env bash
# Generates the two per-instance server-side shared secrets (the access
# gate's Layer 2 — docs/decisions/hosting-walking-skeleton.md's lexercon.com
# amendment) and stores them in GCP Secret Manager, at the secret_id each
# infra/modules/access-gate.google_secret_manager_secret container declares
# ("language-agent-ar-shared-secret" / "language-agent-zh-shared-secret").
#
# STORAGE PATH: Secret Manager, injected into each Cloud Run instance's
# server container as an env var via value_source.secret_key_ref
# (infra/modules/cloud-run-service/main.tf) — never a Terraform variable,
# never tfvars, never this repo. Terraform declares only the secret
# CONTAINER (google_secret_manager_secret, no _version resource); this
# script is what creates the VALUE, out-of-band from `terraform apply`, so
# the raw bytes never enter Terraform state.
#
# THIS SCRIPT IS COMMITTED BUT NOT EXECUTED BY issue #11 PR1 (author + plan
# only, zero cloud mutation). It runs once, near the real `terraform apply`,
# at the keys checkpoint (PR2) — after the google_secret_manager_secret
# containers exist (apply creates them) and before the Cloud Run services
# that read them are deployed with traffic.
#
# Idempotent: skips an instance whose secret already has at least one
# enabled version, so re-running after a partial apply never overwrites a
# secret that's already live and in use.
set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID before running (the real language-agent GCP project id — TBD, see infra/variables.tf)}"

instances=(ar zh)

for instance in "${instances[@]}"; do
  secret_id="language-agent-${instance}-shared-secret"

  if gcloud secrets versions list "$secret_id" \
      --project="$GCP_PROJECT_ID" \
      --filter="state:ENABLED" \
      --format="value(name)" 2>/dev/null | grep -q .; then
    echo "skip: $secret_id already has an enabled version"
    continue
  fi

  echo "generating: $secret_id"
  openssl rand -base64 32 | tr -d '\n' | gcloud secrets versions add "$secret_id" \
    --project="$GCP_PROJECT_ID" \
    --data-file=-
done

echo "done — verify with: gcloud secrets list --project=\"\$GCP_PROJECT_ID\" --filter=\"name~language-agent\""
