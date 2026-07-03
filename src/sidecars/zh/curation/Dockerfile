# The zh CURATION-TOOLCHAIN container (issue #20; ADR dual-instance
# amendment Decision 5).
#
# NEVER DEPLOYED — this is the only container in the tree permitted to run
# g2pW / HanLP / OpenCC (torch lives here and in CI's scheduled drift job
# only). It must never be referenced from any deploy manifest
# (compose.yaml's deployable profiles, the hosting Terraform); its sole
# consumers are the offline curation gate (operator-run) and the scheduled
# non-blocking drift job (.github/workflows/drift-g2pw.yml).
#
# The deployed zh sidecar's torch-free property is INVIOLABLE and untouched:
# src/sidecars/zh/.dockerignore excludes curation/ from the sidecar build
# context, and CI re-runs assert-deterministic-only.sh against the built
# sidecar image on every PR.
#
# Model data: g2pw downloads G2PWModel-v2-onnx (~600 MB) into the workdir on
# first run; HanLP downloads COARSE_ELECTRA_SMALL_ZH into ~/.hanlp; the
# bert-base-chinese tokenizer comes from the HF hub. All at RUN time (this
# image stays thin; CI caches are optional).
FROM python:3.12-slim

WORKDIR /curation
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# The curation tree is bind-mounted at run time (the tools read the repo's
# committed assets + write results back into the worktree):
#   docker build -t language-agent/curation-zh:dev src/sidecars/zh/curation
#   docker run --rm -v "$PWD":/repo -w /repo -e OPENAI_API_KEY \
#     language-agent/curation-zh:dev \
#     python3 src/sidecars/zh/curation/tools/gate_g2pw.py --check \
#       src/sidecars/zh/curation/baseline/g2pw-drift-baseline.json
CMD ["python3", "--version"]
