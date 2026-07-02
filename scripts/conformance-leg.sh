#!/usr/bin/env bash
# The CI drop-in matrix leg runner (ADR §4.3; issue #17): one leg = one
# language pack's TCK instantiation, `pnpm --filter @la/lang-<lang> run
# test:conformance`. The SAME runner serves every leg — dropping a new
# language in means adding a matrix entry, never editing this script.
#
# A leg whose pack (or conformance instantiation) does not exist yet fails
# LOUDLY with the issue that completes it — that red is the designed state
# of the `ar` leg (completes with #7/#9) and the `zh` leg (completes with
# #19/#21) until those children land. ci.yml runs those legs with
# `continue-on-error: true`, and only the `fake` leg is a required check,
# so an incomplete leg can never red the merge queue (#17's
# non-blocking-legs AC; #9/#21 flip ar/zh to required).
#
# Run from the repo root, after `pnpm install` and `pnpm run build`
# (cross-package @la/* imports resolve through exports maps to dist/).
set -euo pipefail

lang="${1:?usage: scripts/conformance-leg.sh <fake|ar|zh>}"
pkg_dir="src/packages/lang-${lang}"

completes_with() {
  case "$1" in
    ar) echo "#7 (Arabic sidecar) / #9 (E2E turn script)" ;;
    zh) echo "#19 (zh verification sidecar v0) / #21 (@la/lang-zh v0)" ;;
    *) echo "its language-pack issue" ;;
  esac
}

if [ ! -f "${pkg_dir}/package.json" ]; then
  echo "::error::@la/lang-${lang} does not exist yet — this matrix leg completes with $(completes_with "${lang}")." >&2
  exit 1
fi

if ! grep -q '"test:conformance"' "${pkg_dir}/package.json"; then
  echo "::error::@la/lang-${lang} has no test:conformance script yet — its describeLanguagePack instantiation completes with $(completes_with "${lang}")." >&2
  exit 1
fi

exec pnpm --filter "@la/lang-${lang}" run test:conformance
