// @la/lang-ar — placeholder package root.
//
// Real content (the Arabic LanguagePack implementing the nine contract
// ports, plus its `/react` and `/assets` subpath exports) is owned by
// issue #7 (Arabic sidecar) and successors (#8 seed vocab, #10 renderer).
//
// This file exists only so the package installs, typechecks, and has a
// working `exports` map (ADR §2.4 mechanism 3) before any package has
// content worth protecting.
export const LANG_AR_PLACEHOLDER = true as const;
