#!/usr/bin/env bash
# Concept-drift gate — keep a refocused product's RETIRED vocabulary off the
# live surfaces, while the canonical noun stays the one present-tense product
# claim.
#
# PORTABLE BY DESIGN: this script embeds NO product words. It READS the
# product's vocabulary from INSTANCE.md → "Product concept (canonical noun)"
# (the `CANONICAL-NOUN:` line and every `RETIRED-TERM:` line). The mechanism +
# the default allowlist ship generic in the template; each instance declares its
# own retired terms in that one block. That mirrors the template's other
# instance/mechanism splits (the reviewing rubric vs the pr-workflow instance
# facts; the `julianken-bot` / `mFjP4XMgcvdwzloZL9EMze` blank-disables-module
# pattern).
#
# It is an ALLOWLIST gate, not a denylist: it scans only the LIVE surfaces a
# user or the LLM reads as a present-tense product claim — not history (old
# decisions/research/plans, never retro-edited), not deliberately-retained
# machinery (tagged, not deleted), not tests. A retired term legitimately
# survives in those places; on a scanned line it passes only via the per-line
# escape hatch below, never via whole-file suppression.
#
# A matched line FAILS unless it carries, on the SAME line, one of the
# sanctioned escapes (see AGENTS.md → "DORMANT / RETAINED tag spec"):
#   (a) `DORMANT:`            — a path intentionally retained but on no live path;
#   (b) `RETAINED:`           — a dependency/asset deliberately kept though unused;
#   (c) `concept-drift-ok: <reason>` — explicit allow for legit retired-term prose
#                                      (roadmap north-star, a route/code identifier,
#                                      the retired-terms list itself).
#
# PRE-CODE SAFE: an allowlist directory the product doesn't have yet (e.g. no
# `src/` on a fresh instance) is skipped, not an error — the template is pre-code
# (INSTANCE.md → "Status"). An unfilled instance, whose only RETIRED-TERM is the
# neutral REPLACE-AT-BOOTSTRAP sentinel, declares no real retired term, so the
# gate is inert and exits 0.
#
# Prints every offending `file:line` before exiting non-zero. Run from anywhere
# inside the repo. Exit 0 = clean, exit 1 = drift detected.
#
# bash 3.2-safe: no `mapfile` (bash 4+ only) — this must run on the macOS bash
# 3.2 a developer has by default as well as on CI's ubuntu-latest.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

concept_file="INSTANCE.md"

# The neutral bootstrap sentinel for an unfilled RETIRED-TERM. A retired term
# still set to this value is "not declared yet" and is ignored — so a fresh
# product (no refocus has happened) has an inert gate. Replaced per-instance at
# the first refocus (see INSTANCE.md → "Product concept").
sentinel='REPLACE-AT-BOOTSTRAP'

# --- Read the per-instance vocabulary from the CONCEPT block ------------------
# Parse the `RETIRED-TERM:` lines: take the text after the marker, then cut at
# the FIRST terminator — a backtick (the closing of the `RETIRED-TERM: term`
# code span), an inline HTML comment (`<!--`, which is where a per-line
# `concept-drift-ok:` escape lives so the list line doesn't self-trip), or an
# italic/parenthetical note (`*(use X instead)*`). Then trim whitespace/backticks
# and drop the unfilled sentinel and any `{{PLACEHOLDER}}`-only value (an
# unreplaced template token = "not declared yet", same as the sentinel). One
# `sed` pass, no `grep -P`/`mapfile` — portable across bash 3.2 + BSD/GNU sed.
retired_terms=()
if [ -f "$concept_file" ]; then
  while IFS= read -r raw; do
    # Strip everything up to and including the first `RETIRED-TERM:` marker, then
    # cut at the first backtick / `<!--` / `*` / `(` terminator.
    term="$(
      printf '%s' "${raw#*RETIRED-TERM:}" \
        | sed -e 's/`.*$//' -e 's/<!--.*$//' -e 's/[*(].*$//' \
              -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
    )"
    [ -n "$term" ] || continue
    [ "$term" = "$sentinel" ] && continue
    case "$term" in
      '{{'*'}}') continue ;;  # an unreplaced placeholder token = not declared yet
    esac
    retired_terms+=("$term")
  done < <(grep -E '^[[:space:]-]*`?RETIRED-TERM:' "$concept_file" || true)
fi

if [ "${#retired_terms[@]}" -eq 0 ]; then
  echo "OK: no retired terms declared in $concept_file → concept-drift gate is inert (fresh / unfilled instance)."
  exit 0
fi

# Build an alternation regex from the literal retired terms. Escape regex
# metacharacters so a term with `(`/`.`/`*` etc. is matched literally (grep -iF
# would be ideal but loses multi-term alternation in one pass; we escape instead).
escape_re() { printf '%s' "$1" | sed -e 's/[.[\\*^$()+?{}|]/\\&/g'; }
retired_regex=""
for t in "${retired_terms[@]}"; do
  e="$(escape_re "$t")"
  if [ -z "$retired_regex" ]; then retired_regex="$e"; else retired_regex="$retired_regex|$e"; fi
done

# --- The per-line ESCAPE HATCHES (any one passes a matched line) --------------
escape_regex='DORMANT:|RETAINED:|concept-drift-ok:'

# --- LIVE-surface ALLOWLIST (sane default; widen/narrow per product) ----------
# Default-with-escape-hatch (the template's CSO discipline): a product that has a
# different layout edits these lists. Resolved against tracked files only
# (git ls-files), so a stray untracked scratch file can't trip or dodge the gate.
#
# DELIBERATELY NOT a `**` git pathspec: git's default pathspec semantics make `*`
# cross `/` while a `**` pattern needs `:(glob)` magic to behave — both surprise,
# and a `**` glob silently missed top-level files (the bug this avoids). Instead
# each allow_dirs entry is a DIRECTORY PREFIX + an EXTENSION regex, resolved by
# listing the tree under the prefix and grepping the extension.
#
# allow_dirs: "<dir-prefix>:<ext-regex>" — every tracked file under <dir-prefix>
# whose path matches <ext-regex>. A prefix the product doesn't have yields no
# files (pre-code safe).
allow_dirs=(
  'src/app:\.(tsx|jsx|ts|js)$'  # user-facing copy (incl. top-level page/layout)
  'src/pipeline:\.(ts|js)$'     # LLM-facing stage prompts (if present)
)
# allow_files: exact tracked paths — the public/SoT product descriptors.
allow_files=(
  'INSTANCE.md'  # the instance source of truth (incl. the concept block)
  'AGENTS.md'    # process SoT (product-noun prose lives here too)
  'README.md'    # public product descriptor
  'DESIGN.md'    # design SoT
)

# --- SKIPLIST — fenced out even when an allow rule matches --------------------
# Historical trees (never retro-edited) and test files (assert the dormant
# shape, not user copy). A product extends this for its own retained-machinery
# files (or tags those lines DORMANT:/RETAINED: at the source instead).
skip_regex='^docs/decisions/|^docs/research/|^docs/plans/|\.test\.(ts|tsx|js|jsx)$|\.spec\.(ts|tsx|js|jsx)$'

# Resolve the allowlist to a deduped, skiplist-filtered set of tracked files.
files="$(
  {
    for rule in "${allow_dirs[@]}"; do
      dir="${rule%%:*}"
      ext="${rule#*:}"
      git ls-files -- "$dir" | grep -E "$ext" || true
    done
    for f in "${allow_files[@]}"; do
      git ls-files -- "$f"
    done
  } | sort -u | grep -Ev "$skip_regex" || true
)"

fail=0
while IFS= read -r f; do
  [ -n "$f" ] || continue
  [ -f "$f" ] || continue
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    lineno="${line%%:*}"
    content="${line#*:}"
    if printf '%s' "$content" | grep -qiE "$escape_regex"; then
      continue
    fi
    echo "DRIFT: $f:$lineno"
    fail=1
  done < <(grep -niE "$retired_regex" "$f" || true)
done <<< "$files"

if [ "$fail" -eq 0 ]; then
  echo "OK: no concept drift — retired product terms are absent or escaped on every live surface."
else
  echo ""
  echo "FAILED: a retired product term appears on a live surface without an escape." >&2
  echo "Fix the copy to the canonical noun (INSTANCE.md → 'Product concept'), OR — if the term is" >&2
  echo "legitimate (retained machinery / code identifier / roadmap north-star) — add an inline" >&2
  echo "'DORMANT:' / 'RETAINED:' tag or a 'concept-drift-ok: <reason>' comment on that line." >&2
  echo "See AGENTS.md → 'DORMANT / RETAINED tag spec'." >&2
  exit 1
fi
