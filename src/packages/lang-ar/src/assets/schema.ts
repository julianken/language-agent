/**
 * `@la/lang-ar`'s seam-9 asset row schema (issue #8) — the ROW/CONTENT
 * schema a pack authors and points its `assetManifest` entry's
 * `spineSchema` at (contract `AssetManifest`, `src/packages/contract/src/
 * assets.ts`: `{ path, spineSchema: z.ZodType }` is only the WRAPPER —
 * content validation is pack-owned). Mirrors the `@la/lang-fake` precedent
 * (`src/packages/lang-fake/src/assets-schema.ts`'s `LexiconRowSchema`):
 * spine-ish identity columns + the module's own extension payload columns.
 *
 * Ownership (issue #8 plan-review resolution, gate comment
 * https://github.com/julianken/language-agent/issues/8#issuecomment-4871030126):
 * this schema is authored HERE, by #8 — #7 owns only the seam-3 annotation
 * schema (`../annotations.ts`) and #16 owns only the generic seam-9 PORT
 * type (`AssetManifest`), never a pack's concrete row shape.
 *
 * Columns:
 *  - SPINE (identity, mirrors lang-fake's `lexemeId`/`surface`):
 *      `lexemeId` — a stable per-row id, unique within this asset.
 *      `surface`  — the BARE (undiacritized) consonantal skeleton;
 *                   `dediac(diac) === surface` is a self-consistency
 *                   invariant this module's own tests assert (mirrors the
 *                   sidecar gate's leg-1 dediac round-trip, cheaply,
 *                   without booting the sidecar).
 *  - AR EXTENSION PAYLOAD (docs/research/arabic-validation.md §6–§7):
 *      `diac`    — the fully-vocalized (diacritized) MSA citation form —
 *                  the exact string every curated entry sends as
 *                  `VerifyRequest.targetText` when validated against the
 *                  real ar sidecar's `POST /v1/verify` (see
 *                  `../../scripts/validate-seed-vocab.mjs`); every shipped
 *                  row is confirmed GREEN through that real gate before
 *                  merge (issue #8 AC2 — no human gold pass, machine-only).
 *      `lemma`   — the dictionary citation-form lemma (may equal `diac`
 *                  for words with no separate case/mood ending, e.g. verbs
 *                  and the "five nouns"; informational/display only — the
 *                  gate never cross-checks it).
 *      `gloss`   — the intended English sense. This is also the exact
 *                  string sent as the turn intent's `description` when
 *                  validating (the "intended-sense tuple" issue #8 AC2
 *                  requires) — the gate's `camel-morph` leg aligns its
 *                  chosen analysis against this gloss's words.
 *      `senseId` — disambiguates polysemous lemmas that could otherwise
 *                  share one skeleton (e.g. a future second sense of a
 *                  lemma already seeded here) — the `(lemma, sense)` key
 *                  docs/plans/vocabulary-system.md §1(a)/§6 keys mastery
 *                  state on.
 *      `tier`    — `docs/plans/vocabulary-system.md` §2 Q4 / §4: tier-0
 *                  ("~30 freebies" — recognizable loanwords + Arabic
 *                  numeral words) or tier-1 ("~100" high-imageability A1
 *                  thematic content words). Both tiers stay hand-curated
 *                  per the locked decision (§8 row 8): cleanroom, never
 *                  redistributing Buckwalter–Parkinson/SAMER/KELLY — those
 *                  sources are used only offline, for rank/selection
 *                  GUIDANCE, never copied into this asset.
 */

import { z } from "zod";

/** `docs/plans/vocabulary-system.md` §2 Q4's two hand-curated seed tiers. */
export const ArSeedVocabTierSchema = z.enum(["tier-0", "tier-1"]);
export type ArSeedVocabTier = z.infer<typeof ArSeedVocabTierSchema>;

export const ArSeedVocabRowSchema = z.strictObject({
  // --- spine columns (identity) ---
  lexemeId: z.string().min(1),
  surface: z.string().min(1),
  // --- ar extension payload columns ---
  diac: z.string().min(1),
  lemma: z.string().min(1),
  gloss: z.string().min(1),
  senseId: z.string().min(1),
  tier: ArSeedVocabTierSchema,
});
export type ArSeedVocabRow = z.infer<typeof ArSeedVocabRowSchema>;

export const ArSeedVocabSchema = z.array(ArSeedVocabRowSchema);
export type ArSeedVocab = z.infer<typeof ArSeedVocabSchema>;
