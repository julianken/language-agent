#!/usr/bin/env bash
# Regenerates the Pydantic v2 models from the hand-authored shared OpenAPI
# document (ADR §3.2, Python codegen pipeline):
#
#   src/packages/contract/sidecar/openapi.yaml
#     → src/sidecars/ar/generated/models.py
#
# The FastAPI routes of the ar sidecar (issue #7 stage 2) must type against
# these models — the implementation types AGAINST the contract, it never
# emits it.
#
# Runs datamodel-code-generator under uv (uvx) at the exact version pinned
# in src/sidecars/ar/codegen/requirements.txt, with its FULL transitive
# closure pinned by src/sidecars/ar/codegen/requirements.lock (uv pip
# compile --universal; the PR #27 review suggestion — symmetric
# reproducibility with the fully-locked node codegen half, so a transitive
# release can never flip the freshness gate red on an unrelated PR). CI
# runs THIS script and then `git diff --exit-code -- src/sidecars/ar/generated`,
# so the command below is the command that actually runs — keep flags
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
