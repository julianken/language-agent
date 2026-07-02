# src/packages/lang-zh

Placeholder root for the Chinese language module. This directory deliberately
carries **no `package.json`** yet — it is outside the pnpm workspace until the
`@la/lang-zh` v0 child (#21) lands the nine-port package.

What exists now (authored by the zh sidecar child, #19):

- `assets/` — the **curation stub**: ~a dozen curation-shaped seed tuples, the
  minimal C9-style context table for the v0 sliver function-word subset
  (constraint C3: {的, 了, 不, 一} plus 嗎/呢 admitted as pinned singles —
  the committed definition lives in issue #19 step 2(a)), and the
  segmenter-boundary normalization map. Every file is marked
  `provenance: stub — replaced wholesale by #20`. The stub was co-designed
  with the zh sidecar's golden fixtures (per #19's plan review) so the
  sidecar's pass-case ACs close honestly against it; it is NOT curated seed
  content — #20 (the zh seed sliver child) owns curation and replaces these
  files wholesale, at which point the sidecar's build-generated lexicon
  freshness gate (`src/sidecars/zh/scripts/build_lexicon.py` +
  `git diff --exit-code` in CI) forces a rebuild against the real asset.

Ownership boundaries:

- **#20** — the real seed sliver (~30–100 TOCFL-spine Traditional words,
  every tuple pre-verified offline through the FULL gate at curation), the
  real C9 context enumeration, and the full C1–C9 curation-constraint set.
- **#21** — the `@la/lang-zh` package itself: nine TS ports, ruby/LTR
  renderer registry entry, the zod annotation schema formalizing
  `zh-annotations/v1`, golden corpus, recorded replay responses.
