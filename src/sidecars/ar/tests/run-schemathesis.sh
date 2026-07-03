#!/usr/bin/env bash
# Schemathesis property-fuzz of the LIVE sidecar against the UNCHANGED
# shared spec (mounted read-only at /contract/openapi.yaml — it lives
# outside this image on purpose: the implementation types against the
# contract, it never carries or emits it).
#
# CI runs this inside `docker run --network none …`, so the same run also
# proves the offline-at-runtime AC: server boot, DB availability, and the
# whole fuzz complete with zero network access.
set -euo pipefail

SPEC="${SPEC_PATH:-/contract/openapi.yaml}"

uvicorn app.main:app --host 127.0.0.1 --port 8000 &
UVICORN_PID=$!
trap 'kill "$UVICORN_PID" 2>/dev/null || true' EXIT

python - <<'PY'
import sys, time, urllib.request

for _ in range(240):
    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/readyz", timeout=2) as response:
            if response.status == 200:
                sys.exit(0)
    except Exception:
        pass
    time.sleep(0.5)
sys.exit("readyz never returned 200")
PY

schemathesis run "$SPEC" \
  --url http://127.0.0.1:8000 \
  --checks all \
  --max-examples 75 \
  --seed 7
