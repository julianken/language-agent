#!/usr/bin/env bash
# The CI drop-in matrix leg runner (ADR §4.3; issue #17): one leg = one
# language pack's TCK instantiation, `pnpm --filter @la/lang-<lang> run
# test:conformance`. The SAME runner serves every leg — dropping a new
# language in means adding a matrix entry, never editing this script.
#
# A leg whose pack (or conformance instantiation) does not exist yet fails
# LOUDLY with the issue that completes it. This is the safety net for
# ci.yml's live-set mechanism: not-yet-live legs (`ar` → #7/#9, `zh` →
# #19/#21) are ABSENT from the conformance matrix, so CI only invokes this
# runner for live legs. If a leg is ever added to that live-set before its
# pack exists, this fail-loud guarantees a green check can never be a
# fake-green — it errors instead of silently passing. Only the `fake` leg
# is live and required today; #9/#21 add `ar`/`zh` to the live-set (and the
# matching required checks / Mergify queue conditions).
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
