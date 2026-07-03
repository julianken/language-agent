# `@la/lang-ar` seed vocabulary — provenance

This directory ships with the `@la/lang-ar` package (`package.json` →
`files: ["dist", "assets"]`), so this note travels **with** the asset it
describes — `seed-vocab.json` — wherever the package is published or
vendored. (The row schema's own docstring lives in
`../src/assets/schema.ts`, which the `dist` glob compiles but does not ship
as source; this file is the shipped-alongside copy of the provenance facts.)

## What `seed-vocab.json` is

The Arabic seed vocabulary sliver (issue #8): **60 hand-curated entries**,
conforming to `ArSeedVocabRowSchema` (`../src/assets/schema.ts`). Each row
carries the spine columns (`lexemeId`, `surface`) plus the ar extension
payload (`diac` fully-vocalized MSA, `lemma`, `gloss`, `senseId`, `tier`).

**Tier split (60 total):**

- **20 tier-0** — the `docs/plans/vocabulary-system.md` §2 Q4 "freebies":
  10 recognizable loanwords + the 10 numeral words `zero`–`nine`.
- **40 tier-1** — high-imageability A1 thematic content words across
  greetings/people, family, food/drink, home, time, and common actions.

## Cleanroom curation (the load-bearing provenance claim)

Every entry is **hand-authored**. **Nothing was copied** from any
frequency list, dictionary, or lexicon.

- **Buckwalter & Parkinson** (*A Frequency Dictionary of Arabic*) — and the
  other benchmark lists named in `docs/plans/vocabulary-system.md` §8
  (SAMER, KELLY) — were used **only as an offline frequency/rank REFERENCE**
  to decide *which* everyday lemmas a beginner meets first. No ranks,
  glosses, or list content are redistributed in this asset. This matches
  the locked cleanroom-from-the-start decision (§8 row 8).
- Each entry's **fully-vocalized `diac` form was confirmed against the
  calima-msa-r13 morphological analyzer's own legal vocalizations** — the
  vocalization shipped is one the analyzer itself licenses for that
  skeleton, not a hand-guessed diacritization.

## Validation (machine-only, no human gold pass)

Every entry is validated GREEN through the **real** Arabic verification
sidecar's `POST /v1/verify` endpoint (`src/sidecars/ar`, the
`dediac-roundtrip` + `camel-morph` calima-msa-r13 gate legs) — **not** the
Prism mock and **not** a direct camel-tools library call, either of which
could pass vacuously or diverge from the deployed gate. The turn intent
carries each entry's intended-sense gloss, so the analyzer-membership leg
verifies the vocalization against the *intended* sense.

The gate is `../scripts/validate-seed-vocab.mjs` (`pnpm --filter @la/lang-ar
run validate:seed-vocab`); it exits non-zero on any non-GREEN entry and runs
in CI (the `sidecar-ar` job) against the CI-built sidecar image on every PR.
As of the seed's introduction: **60/60 entries GREEN**.

This asset is analyzer-self-consistent by construction and requires **no
human native-checker gold pass** — the operator-ratified asymmetry vs the
zh seed sliver (#20), which does budget a one-time gold pass.
