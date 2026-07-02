// @la/engine — placeholder package root.
//
// Engine is language-blind: it must never import a `@la/lang-*` package
// (ADR §2.4 rule a, enforced by .dependency-cruiser.cjs + pnpm strict
// resolution) and must never branch on `lang === ` / `language === `
// (ADR §2.4 mechanism 4, enforced by eslint.config.mjs +
// scripts/check-no-lang-conditional.sh). Real content (the turn loop,
// scheduler cascade, tuple store) is built out starting with issue #9.
//
// This file exists only so the package installs, typechecks, and has a
// working `exports` map (ADR §2.4 mechanism 3) before any package has
// content worth protecting.
export const ENGINE_PLACEHOLDER = true as const;
