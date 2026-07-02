// @la/web shell — language-blind by construction.
//
// `apps/web/src/shell` is one of the three paths the no-`lang===` gate
// covers (ADR §2.4 mechanism 4, alongside packages/engine and
// apps/server/src). It renders `<TokenRenderer token={t}/>` generically and
// must never branch on `lang === ` / `language === `.
//
// Real content lands with issue #10 and successors. This file exists only
// so the directory (and the boundary gate's scope) exist from the first
// commit.
export const SHELL_PLACEHOLDER = true as const;
