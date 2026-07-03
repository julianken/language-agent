#!/usr/bin/env bash
# Regenerates the Pydantic v2 models from the hand-authored shared OpenAPI
# document (ADR §3.2, Python codegen pipeline):
#
#   src/packages/contract/sidecar/openapi.yaml
#     → src/sidecars/ar/generated/models.py
#     → src/sidecars/zh/generated/models.py
#
# The FastAPI routes of each sidecar (ar: issue #7 stage 2; zh: issue #19)
# must type against these models — the implementation types AGAINST the
# contract, it never emits it.
#
# Runs datamodel-code-generator under uv (uvx) at the exact version pinned
# per sidecar in src/sidecars/*/codegen/requirements.txt. The ar pin
# additionally carries its FULL transitive closure in
# src/sidecars/ar/codegen/requirements.lock (uv pip compile --universal;
# the PR #27 review suggestion — symmetric reproducibility with the
# fully-locked node codegen half, so a transitive release can never flip
# the freshness gate red on an unrelated PR). CI runs THIS script and then
# `git diff --exit-code -- src/sidecars/<lang>/generated`, so the commands
# below are the commands that actually run — keep flags
# deterministic (--disable-timestamp is load-bearing for the freshness gate).
set -euo pipefail

cd "$(cd "$(dirname "$0")/.." && pwd)"

PIN_FILE="src/sidecars/ar/codegen/requirements.txt"
LOCK_FILE="src/sidecars/ar/codegen/requirements.lock"
PIN="$(grep -E '^datamodel-code-generator==' "$PIN_FILE")"

mkdir -p src/sidecars/ar/generated

uvx --with-requirements "$LOCK_FILE" --from "$PIN" datamodel-codegen \
  --input src/packages/contract/sidecar/openapi.yaml \
  --input-file-type openapi \
  --output src/sidecars/ar/generated/models.py \
  --output-model-type pydantic_v2.BaseModel \
  --target-python-version 3.12 \
  --disable-timestamp \
  --use-double-quotes \
  --use-schema-description \
  --use-standard-collections \
  --use-union-operator \
  --formatters builtin

echo "wrote src/sidecars/ar/generated/models.py"

# --- zh (issue #19) — identical pipeline, zh's own pin file. Additive block
# on purpose: the ar block above is #7's and stays byte-identical.
ZH_PIN_FILE="src/sidecars/zh/codegen/requirements.txt"
ZH_PIN="$(grep -E '^datamodel-code-generator==' "$ZH_PIN_FILE")"

mkdir -p src/sidecars/zh/generated

uvx --from "$ZH_PIN" datamodel-codegen \
  --input src/packages/contract/sidecar/openapi.yaml \
  --input-file-type openapi \
  --output src/sidecars/zh/generated/models.py \
  --output-model-type pydantic_v2.BaseModel \
  --target-python-version 3.12 \
  --disable-timestamp \
  --use-double-quotes \
  --use-schema-description \
  --use-standard-collections \
  --use-union-operator \
  --formatters builtin

echo "wrote src/sidecars/zh/generated/models.py"
