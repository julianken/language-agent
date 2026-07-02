// @la/web — placeholder package root.
//
// Real content (the app shell + client-side component registry, importing
// only `@la/lang-*/react` subpaths — never a lang-* package's internals) is
// owned by issue #10 (SSE + React RTL token renderer) and successors.
//
// This file exists only so the package installs, typechecks, and has a
// working `exports` map (ADR §2.4 mechanism 3) before any package has
// content worth protecting.
export const WEB_PLACEHOLDER = true as const;
