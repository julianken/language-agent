#!/usr/bin/env bash
# Issue #10 AC (dual-instance amendment): the shared shell sets no global
# `dir` and owns no direction or ruby assumptions — a grep of
# src/packages/engine and src/apps/web/src/shell finds zero rtl/ltr/ruby
# literals. Direction and ruby are exclusively pack-container concerns
# (@la/lang-*/react and the app's pack-registration layer).
#
# FAIL-LOUD REQUIREMENT (stated in the AC itself): a scoped path that does
# not exist is an ERROR, never a silent pass — a grep over a missing
# directory returns zero hits, which would read as "no direction code" when
# it is really file-not-found (the plan review's silently-pass-for-the-
# wrong-reason hazard; same inert-gate class as PR #25 review finding 1).
#
# node_modules EXCLUSION (issue #9 fix, same root cause as
# check-no-engine-fade.sh): `grep -R` follows symlinks, and pnpm's
# workspace linking puts a `node_modules/@la/contract` SYMLINK inside every
# package that declares it as a dependency, including
# src/packages/engine — recursing into it would false-positive on
# contract's own (legitimate) content.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

scoped_paths=(
  "src/packages/engine"
  "src/apps/web/src/shell"
)

# Case-insensitive, and 'dir="' catches a hardcoded direction attribute the
# word-pattern would miss. No exceptions: these paths have no legitimate
# use for any of these literals.
pattern='rtl|ltr|ruby|dir="|dir='"'"''

fail=0
for scoped_path in "${scoped_paths[@]}"; do
  if [ ! -d "$scoped_path" ]; then
    echo "FAILED: scoped path '$scoped_path' does not exist — the gate's path anchors have drifted from the tree; re-anchor scoped_paths in $0."
    exit 1
  fi
  if grep -RniE "$pattern" "$scoped_path" --include='*.ts' --include='*.tsx' --exclude-dir='node_modules'; then
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "FAILED: direction/ruby-specific code found in the language-blind shell or engine (issue #10 AC; dual-instance amendment)."
  exit 1
fi
echo "PASS: no rtl/ltr/ruby/dir literals under ${scoped_paths[*]}."
