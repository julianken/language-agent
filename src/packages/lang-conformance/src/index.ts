// @la/lang-conformance — placeholder package root.
//
// Real content (the parameterized `describeLanguagePack` Vitest suite, the
// fast-check laws, the golden-fixture harness, `probeSidecar`) is
// exclusively owned by issue #17 (lang-conformance-tck). This package must
// depend only on @la/contract (never engine, never a lang-* package) — ADR
// §4.1.
//
// This file exists only so the package installs, typechecks, and has a
// working `exports` map (ADR §2.4 mechanism 3) before any package has
// content worth protecting.
export const LANG_CONFORMANCE_PLACEHOLDER = true as const;
