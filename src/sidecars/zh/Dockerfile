# zh verification sidecar v0 — deterministic legs only (issue #19).
#
# python:3.12-slim + FastAPI/uvicorn + pypinyin + jieba + the baked tables
# (CC-CEDICT/Unihan extracts, the build-generated sliver lexicon, NOTICE).
# Size class: est. 300–600 MB (hosting ADR dual-instance amendment); the
# measured number is recorded in docs/decisions/hosting-walking-skeleton.md.
#
# OFFLINE AT RUNTIME by construction: every table and dictionary is baked at
# build time (jieba's dict ships inside its wheel; pip runs only here). CI
# verifies by running the container with --network=none and exercising the
# full endpoint surface (scripts/offline_smoke.py).
#
# NO NEURAL STACK: torch/transformers/g2pW/HanLP/OpenCC/pkuseg must never
# appear (regression by construction — Decision 1). CI asserts against the
# built image via scripts/assert-deterministic-only.sh.
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY generated/ generated/
COPY app/ app/
COPY data/ data/
COPY scripts/offline_smoke.py scripts/offline_smoke.py

# Non-root; jieba builds its prefix-dict cache in /tmp at first start
# (part of the seconds-scale warmup /readyz gates — no model load).
RUN useradd --system --uid 10001 sidecar
USER sidecar

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
