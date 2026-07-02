// @la/contract — placeholder package root.
//
// Real content (the nine port types incl. text-in/tokens-out `verify`, the
// token spine, annotation + LearningEvent envelopes, the mastery-graph
// declaration types, the manifest zod schema, and the hand-authored sidecar
// OpenAPI document) is exclusively owned by issue #16 (contract-v0) — see
// docs/decisions/language-module-architecture.md §5.1/§5.2.
//
// This file exists only so the package installs, typechecks, and has a
// working `exports` map (ADR §2.4 mechanism 3: deep imports fail at
// resolution; the public surface is the contract) from the first commit —
// before any package has content worth protecting.
export const CONTRACT_PLACEHOLDER = true as const;
