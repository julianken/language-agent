# The Arabic verification sidecar image (issue #7 stage 2).
#
# Shape is prescribed by docs/decisions/hosting-walking-skeleton.md:
#   - python:3.12-slim (glibc — never Alpine; camel-tools ships manylinux
#     wheels).
#   - The ADR prune list (nvidia-*, torch, triton, transformers, sympy,
#     scikit-learn, pandas) MUST NOT be in the image. This Dockerfile uses
#     the ADR's sanctioned "--no-deps + explicit deps" alternative: the full
#     transitive lock (requirements.lock) is filtered of the prune list and
#     installed with --no-deps, so the ~4.9 GB ML stack never enters ANY
#     layer (vs. install-then-uninstall-in-one-layer, which downloads it).
#     A torch reappearance is a REGRESSION (tests/test_prune_regression.py
#     + the CI prune step both assert absence).
#   - `camel_data -i morphology-db-msa-r13` at BUILD time (~40.5 MB;
#     explicitly NOT the `light`/`defaults` bundles) with CAMELTOOLS_DATA
#     baked, so the container is fully offline at runtime (no network, no
#     auto-download) — CI runs the whole test battery under --network none.
#   - The calima-msa-r13 morphology DB *data* is GPL-2 (the service code and
#     camel-tools itself are MIT) — the notice ships in the image at
#     /licenses (see licenses/NOTICE.md).
#
# Deploy spec (hosting ADR): 1 GiB memory for this container (analyzer RSS
# ≈ 399 MB; 512 MB is too tight with the HTTP layer on top).

FROM python:3.12-slim AS runtime

ENV CAMELTOOLS_DATA=/opt/camel-data \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /srv

COPY requirements.lock ./

# Filter the ADR prune list out of the full transitive lock, then install
# the remainder with --no-deps (every remaining package is already pinned in
# the lock, so nothing is silently re-resolved). Then pull the morphology DB
# at build time. One layer: no prune-listed wheel ever lands in the image.
RUN grep -vE '^(nvidia-|torch==|triton==|transformers==|sympy==|scikit-learn==|pandas==)' requirements.lock > /tmp/requirements.pruned \
 && pip install --no-cache-dir --no-deps -r /tmp/requirements.pruned \
 && mkdir -p "$CAMELTOOLS_DATA" \
 && camel_data -i morphology-db-msa-r13 \
 && rm /tmp/requirements.pruned

COPY licenses/ /licenses/
COPY generated/ ./generated/
COPY app/ ./app/

EXPOSE 8000

# Cloud Run wiring (issue #11): startup probe on /readyz, liveness on
# /healthz; size failureThreshold × periodSeconds to the measured warmup
# recorded in the #7 stage-2 PR body.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]


# Test stage: runtime + dev deps + the test suite. The shared contract
# artifacts are NOT baked in (they live outside this build context on
# purpose); CI mounts them read-only:
#   -v .../openapi.yaml:/contract/openapi.yaml:ro
#   -v .../ar-annotations.schema.json:/contract/ar-annotations.schema.json:ro
FROM runtime AS test

COPY requirements-dev.lock ./

RUN grep -vE '^(nvidia-|torch==|triton==|transformers==|sympy==|scikit-learn==|pandas==)' requirements-dev.lock > /tmp/requirements-dev.pruned \
 && pip install --no-cache-dir --no-deps -r /tmp/requirements-dev.pruned \
 && rm /tmp/requirements-dev.pruned

COPY tests/ ./tests/
