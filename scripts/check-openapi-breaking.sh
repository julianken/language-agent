#!/usr/bin/env bash
# The oasdiff breaking-change gate over the hand-authored shared OpenAPI
# document (ADR §3.2, §3.5): a BREAKING spec change without a MAJOR bump of
# `info.version` fails. The oasdiff gate stays on even at v0 so every break
# is at least visible (ADR §7 risk 2) — the sanctioned escape is an
# explicit major bump, never a silent mutation.
#
# Usage:
#   bash scripts/check-openapi-breaking.sh            # compares to origin/main
#   BASE_REF=<ref> bash scripts/check-openapi-breaking.sh
#
# Uses a local `oasdiff` binary when present, else the pinned official
# docker image (oasdiff is the real Tufin-origin OpenAPI diff tool:
# github.com/oasdiff/oasdiff; docker.io/tufin/oasdiff).
set -euo pipefail

cd "$(cd "$(dirname "$0")/.." && pwd)"

SPEC="src/packages/contract/sidecar/openapi.yaml"
BASE_REF="${BASE_REF:-origin/main}"
OASDIFF_IMAGE="tufin/oasdiff:v1.21.0"

if ! git rev-parse --verify --quiet "$BASE_REF^{commit}" >/dev/null; then
  echo "check-openapi-breaking: base ref '$BASE_REF' not found — fetch it first" >&2
  echo "(CI does: git fetch --depth=1 origin main && BASE_REF=FETCH_HEAD ...)" >&2
  exit 2
fi

if ! git cat-file -e "$BASE_REF:$SPEC" 2>/dev/null; then
  echo "check-openapi-breaking: no $SPEC at $BASE_REF — new document, gate passes trivially."
  exit 0
fi

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
git show "$BASE_REF:$SPEC" > "$tmpdir/base.yaml"
cp "$SPEC" "$tmpdir/head.yaml"

# The MAJOR component of info.version. The spec keeps the plain
# `  version: MAJOR.MINOR.PATCH` form (a comment there points back here).
major_of() {
  grep -E '^[[:space:]]+version:' "$1" | head -1 \
    | sed -E 's/.*version:[[:space:]]*"?([0-9]+)\..*/\1/'
}
base_major="$(major_of "$tmpdir/base.yaml")"
head_major="$(major_of "$tmpdir/head.yaml")"

if ! [[ "$base_major" =~ ^[0-9]+$ && "$head_major" =~ ^[0-9]+$ ]]; then
  echo "check-openapi-breaking: could not parse MAJOR from info.version (base='$base_major' head='$head_major')" >&2
  exit 2
fi

if (( head_major > base_major )); then
  echo "check-openapi-breaking: info.version major bumped ($base_major → $head_major) — breaking changes are declared, gate passes."
  exit 0
fi

run_oasdiff() {
  if command -v oasdiff >/dev/null 2>&1; then
    oasdiff breaking "$tmpdir/base.yaml" "$tmpdir/head.yaml" --fail-on WARN
  else
    docker run --rm -v "$tmpdir":/specs:ro "$OASDIFF_IMAGE" \
      breaking /specs/base.yaml /specs/head.yaml --fail-on WARN
  fi
}

if ! run_oasdiff; then
  echo "" >&2
  echo "check-openapi-breaking: BREAKING OpenAPI change without a major bump (info.version stays ${base_major}.x)." >&2
  echo "Either make the change additive (ADR §3.5: additive-only within a major) or bump the MAJOR of info.version — and migrate every consumer in the same PR." >&2
  exit 1
fi

echo "check-openapi-breaking: no breaking changes vs $BASE_REF — gate passes."
