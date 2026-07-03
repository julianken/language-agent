#!/usr/bin/env bash
# Issue #10 AC (ADR §1.5): no engine-side code "applies" a fade level —
# fade interpretation lives ONLY under src/packages/lang-* and src/apps/web's
# pack component registrations, never src/packages/engine (and never the
# shared shell, which passes the ScaffoldDirective envelope through opaque).
# Directives are stamped verbatim by the turn loop; a generic engine loop
# over declared dimensions "has no implementable behavior" (ADR §1.5).
#
# FAIL-LOUD REQUIREMENT (stated in the AC itself): a scoped path that does
# not exist is an ERROR, never a silent pass (missing-path grep returns
# zero hits and would silently pass — the plan review's hazard).
#
# node_modules EXCLUSION (issue #9 fix): `grep -R` follows symlinks, and
# pnpm's workspace linking puts a `node_modules/@la/contract` SYMLINK inside
# every package that declares it as a dependency — including
# src/packages/engine, which legitimately depends on @la/contract (ADR
# "engine imports only @la/contract"). Without this exclusion, the gate
# recurses through that symlink into contract's OWN source, where "fade"
# vocabulary is expected and correct (the contract TYPES the seam, it does
# not interpret it) — a false positive with no engine-code violation behind
# it. `--include`-based filtering does not help here since the false
# positives are genuine *.ts files, just on the wrong side of the symlink.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

scoped_paths=(
  "src/packages/engine"
  "src/apps/web/src/shell"
)

# Any fade vocabulary at all in these paths means interpretation leaked out
# of pack code: level literals, dimension ids, or the word itself.
pattern='[Ff]ade|"faded"|"partial"'"|'faded'|'partial'"

fail=0
for scoped_path in "${scoped_paths[@]}"; do
  if [ ! -d "$scoped_path" ]; then
    echo "FAILED: scoped path '$scoped_path' does not exist — the gate's path anchors have drifted from the tree; re-anchor scoped_paths in $0."
    exit 1
  fi
  if grep -RnE "$pattern" "$scoped_path" --include='*.ts' --include='*.tsx' --exclude-dir='node_modules'; then
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "FAILED: fade vocabulary found in engine/shell code — fade interpretation is pack-owned only (issue #10 AC; ADR §1.5)."
  exit 1
fi
echo "PASS: no fade interpretation under ${scoped_paths[*]}."
