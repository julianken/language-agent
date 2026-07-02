#!/usr/bin/env bash
# ADR §2.4 mechanism 4: no `lang === ` / `language === ` conditionals in
# language-blind core code. Literal-text grep backstop for the AST rule in
# eslint.config.mjs — catches the pattern regardless of parser/selector edge
# cases. Scoped to exactly the three paths the ADR names: packages/engine,
# apps/server/src (composition-root file excepted), apps/web/src/shell.
#
# Run from anywhere inside the repo. Exit 0 = gate clear, exit 1 = a
# `lang === ` / `language === ` conditional was found outside the sanctioned
# composition-root file.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

scoped_paths=(
  "packages/engine"
  "apps/server/src"
  "apps/web/src/shell"
)

# The ONE sanctioned exception, mirroring eslint.config.mjs's
# COMPOSITION_ROOT_FILE: the composeApp literal-import registry (owned by
# issue #16) is expected to name languages.
exceptions=(
  "apps/server/src/composeApp.ts"
)

# Matches `lang === `, `lang !== `, `language === `, `language !== `,
# whether the identifier is bare or a member-access tail (e.g.
# `config.language === `).
pattern='(^|[^A-Za-z0-9_])lang(uage)?[[:space:]]*[!=]=='

# Whole-line `//` comments are skipped: this is a coarse literal-text
# backstop for the precise AST rule in eslint.config.mjs, and code that
# documents the gate (like this repo's own placeholder files) legitimately
# needs to reference the pattern in prose without tripping it. A `lang===`
# conditional hiding after a trailing inline comment on a code line is still
# caught, since only FULL comment lines are skipped.
is_comment_line() {
  case "$(printf '%s' "$1" | sed -e 's/^[[:space:]]*//')" in
    "//"*) return 0 ;;
    *) return 1 ;;
  esac
}

fail=0
for scoped_path in "${scoped_paths[@]}"; do
  [ -d "$scoped_path" ] || continue
  while IFS= read -r -d '' file; do
    is_exception=0
    for ex in "${exceptions[@]}"; do
      [ "$file" = "$ex" ] && is_exception=1 && break
    done
    [ "$is_exception" -eq 1 ] && continue

    while IFS=: read -r lineno linetext; do
      is_comment_line "$linetext" && continue
      echo "${file}:${lineno}:${linetext}"
      fail=1
    done < <(grep -EnH "$pattern" "$file" 2>/dev/null | sed "s|^${file}:||")
  done < <(find "$scoped_path" -type f \( -name '*.ts' -o -name '*.tsx' \) -print0)
done

if [ "$fail" -ne 0 ]; then
  echo "FAILED: lang===/language=== conditional found in language-blind core code (ADR §2.4 mechanism 4)."
  exit 1
fi
echo "PASS: no lang===/language=== conditionals under ${scoped_paths[*]}."
