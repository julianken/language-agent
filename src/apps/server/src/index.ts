// @la/server — placeholder package root.
//
// This app is the composition root: the ONLY package permitted to import a
// `@la/lang-*` package (ADR §2.4 rule a) via the literal-specifier registry
// in `composeApp`. `src/apps/server/src/composeApp.ts` (once it exists — owned
// by issue #16) is the sole exception to the no-`lang===` gate
// (eslint.config.mjs, scripts/check-no-lang-conditional.sh) and to the
// dependency-cruiser lang-import rule.
//
// Real content (composeApp, the registry, boot validation, config parsing)
// is owned by issue #16; the hot-path turn loop wiring by issue #9.
//
// This file exists only so the package installs, typechecks, and has a
// working `exports` map (ADR §2.4 mechanism 3) before any package has
// content worth protecting.
export const SERVER_PLACEHOLDER = true as const;
