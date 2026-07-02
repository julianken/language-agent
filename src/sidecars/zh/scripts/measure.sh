#!/usr/bin/env bash
# Measure the built zh sidecar image: size, cold-start (container start →
# first /readyz 200), and RSS after warmup + a few verifies. Fills the zh
# row of docs/decisions/hosting-walking-skeleton.md's measured-numbers table
# (issue #19 AC). Mirrors the methodology of the 2026-07-02 ar spike
# (`linux` image on the host's Docker).
#
# Usage: measure.sh [image]   (default: language-agent/sidecar-zh:measure —
# built from this directory if missing)
set -euo pipefail

IMAGE="${1:-language-agent/sidecar-zh:measure}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
NAME="sidecar-zh-measure-$$"
PORT="${PORT:-8137}"

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  docker build -t "$IMAGE" "$HERE"
fi

SIZE_BYTES=$(docker image inspect "$IMAGE" --format '{{.Size}}')
SIZE_MB=$(awk -v b="$SIZE_BYTES" 'BEGIN{printf "%.0f", b/1000000}')
ARCH=$(docker image inspect "$IMAGE" --format '{{.Os}}/{{.Architecture}}')

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

START_NS=$(python3 -c 'import time; print(time.time_ns())')
docker run -d --rm --name "$NAME" -p "$PORT:8000" "$IMAGE" >/dev/null
while true; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/readyz" || true)
  [ "$CODE" = "200" ] && break
  sleep 0.05
done
END_NS=$(python3 -c 'import time; print(time.time_ns())')
COLD_START=$(awk -v s="$START_NS" -v e="$END_NS" 'BEGIN{printf "%.2f", (e-s)/1e9}')

for _ in 1 2 3 4 5; do
  curl -s -o /dev/null -X POST "http://127.0.0.1:$PORT/v1/verify" \
    -H 'content-type: application/json' \
    -d '{"targetText":"你喝茶嗎？","intents":[{"id":"drink","description":"d"},{"id":"tea","description":"t"}]}'
done
RSS=$(docker stats --no-stream --format '{{.MemUsage}}' "$NAME" | awk '{print $1}')

echo "image:      $IMAGE ($ARCH)"
echo "size:       ${SIZE_MB} MB (${SIZE_BYTES} bytes)"
echo "cold-start: ${COLD_START} s (docker run → first /readyz 200; excludes image pull)"
echo "rss:        ${RSS} (post-warmup, after 5 verifies)"
