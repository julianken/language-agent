// Boundary enforcement for the drop-in language-pack architecture.
// docs/decisions/language-module-architecture.md §2.4, mechanism 2 (the
// four dependency-cruiser rules). These must fire from the first commit
// that could violate them — before any package has real content — per the
// ADR's own citation of spaCy #1816 ("ONE hardcoded lookup path silently
// defeated the whole plugin architecture").
//
// .cjs on purpose: dependency-cruiser's config loader (and this repo's
// devDependency install) resolves a CommonJS config regardless of any
// package.json "type" field, sidestepping ESM/CJS ambiguity entirely.

const PACKAGE_ROOTS = [
  "packages/contract",
  "packages/engine",
  "packages/lang-fake",
  "packages/lang-ar",
  "packages/lang-conformance",
  "apps/server",
  "apps/web",
];

// Rule (b): no deep imports across package roots — only a package's entry
// point (its package.json "exports" map) is a public surface. A RELATIVE
// import that reaches from outside a package into that package's src/dist
// bypasses the exports map entirely (a bare-specifier deep import like
// `@la/lang-ar/src/internal/dediac` is instead caught at module RESOLUTION
// by the exports map itself — ADR §2.4 mechanism 3 — so this rule targets
// the resolution mechanism can't reach: filesystem-relative traversal).
const deepImportRules = PACKAGE_ROOTS.map((root) => ({
  name: `no-deep-import-into-${root.replace(/\//g, "-")}`,
  severity: "error",
  comment:
    `ADR §2.4 rule (b): only ${root}'s entry point (its package.json ` +
    `"exports" map) is a public import surface. A relative import that ` +
    `reaches into ${root}/src or ${root}/dist from OUTSIDE that package ` +
    "bypasses the exports map.",
  from: { path: "^(packages|apps)/", pathNot: `^${root}/` },
  to: {
    path: `^${root}/(src|dist)/`,
    dependencyTypes: ["local"],
  },
}));

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "core-never-imports-lang-packs",
      severity: "error",
      comment:
        "ADR §2.4 rule (a): packages/engine and packages/contract must " +
        "never import a language pack. Only the composition root " +
        "(apps/server, via composeApp's literal-import registry) may " +
        "select one.",
      from: { path: "^packages/(engine|contract)/" },
      to: { path: "^packages/lang-[^/]+/" },
    },
    ...deepImportRules,
    {
      name: "contract-has-zero-workspace-deps",
      severity: "error",
      comment:
        "ADR §2.4 rule (c): @la/contract has zero runtime dependencies on " +
        "the rest of the workspace (engine, lang-*, and the apps all " +
        "depend ON it, never the reverse).",
      from: { path: "^packages/contract/" },
      to: { path: "^(packages|apps)/(?!contract/)[^/]+/" },
    },
    {
      name: "no-circular",
      severity: "error",
      comment: "ADR §2.4 rule (d): no import cycles anywhere in the workspace.",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-unresolvable-la-imports",
      severity: "error",
      comment:
        "Gate self-defense: an @la/* import dependency-cruiser cannot " +
        "resolve is an ERROR, never a silent skip. The packages' `exports` " +
        "maps resolve @la/* only to ./dist/*, so before a build every " +
        "cross-package import is `couldNotResolve` — and an unresolved " +
        "module matches NO path-based forbidden rule, silently disarming " +
        "rules (a)-(c) (PR #25 review finding 1: with dist/ absent, a " +
        "deliberate engine→lang-fake violation produced 'no dependency " +
        "violations found'). This rule makes that state loudly red " +
        "regardless of CI step ordering; ci.yml additionally builds before " +
        "the gate so the graph is actually resolvable.",
      from: {},
      to: { couldNotResolve: true, path: "^@la/" },
    },
  ],
  options: {
    // import type leaks count too, per ADR §2.4 mechanism 2.
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["types", "import", "node", "default"],
    },
    doNotFollow: {
      path: "node_modules",
    },
  },
};
