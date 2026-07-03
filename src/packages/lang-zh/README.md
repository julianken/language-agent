# src/packages/lang-zh

Placeholder root for the Chinese language module. This directory deliberately
carries **no `package.json`** yet — it is outside the pnpm workspace until the
`@la/lang-zh` v0 child (#21) lands the nine-port package.

What exists now (#19 scaffolded the shape; #20 landed the real content):

- `assets/` — the **real curated seed sliver** (issue #20, wholesale-replacing
  #19's curation stub): 58 hand-curated TOCFL/SC-TOP band-1 Traditional
  tuples (`seed-tuples.json`; one flagged exemplar exception, 展覽館), the
  267-entry C9 context enumeration for the C3 singles ({的, 了, 不, 一} plus
  嗎/呢 — `c9-context-table.json`), and the jieba boundary-normalization map
  (`segmenter-normalization.json`). Every file is BUILD-GENERATED from the
  curation sources in `src/sidecars/zh/curation/` (never hand-edited) and
  marked `provenance: curated — machine gate complete; native gold pass
  pending (#20 AC7)`. Every tuple and context carries a recorded pass
  through the full offline machine gate
  (`src/sidecars/zh/curation/results/gate-results.json`); the replacement
  tripped the sidecar's build-generated lexicon freshness gate
  (`src/sidecars/zh/scripts/build_lexicon.py` + `git diff --exit-code` in
  CI) by design, and the baked lexicon was rebuilt against this asset in
  the same PR. The files follow the contract's `AssetManifest` discipline
  (named assets; shared spine columns + zh payload columns; boot validation
  = existence + spine-schema validity per ADR §1.3 seam 9); the zod
  `spineSchema` binding lands with the `@la/lang-zh` package (#21), which
  declares `assets: { 'seed-tuples': …, 'c9-context-table': …,
  'segmenter-normalization': … }` over exactly these paths.

Ownership boundaries:

- **#20 (landed)** — the real seed sliver, the C9 context enumeration, the
  C1–C9 curation-constraint set, the curation-toolchain container, the
  recorded machine-gate results and the g2pW drift baseline. The one-time
  native-checker gold pass (AC7) remains #20's open completion step
  (GAPS.md row; ready-to-dispatch task package in
  `src/sidecars/zh/curation/goldpass/`).
- **#21** — the `@la/lang-zh` package itself: nine TS ports, ruby/LTR
  renderer registry entry, the zod annotation schema formalizing
  `zh-annotations/v1`, golden corpus, recorded replay responses.
