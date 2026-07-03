/**
 * `@la/lang-zh`'s canonical annotation ZOD SCHEMA — the `schema` half of
 * seam 3 (`AnnotationCodec<TAnn>`, ADR §1.3 port 3), and ONLY that half.
 * This zod schema is the SINGLE canonical source (ADR §3.4): the sibling
 * `zh-annotations.schema.json` artifact is GENERATED from it
 * (`scripts/generate-annotation-schema.mjs`, via `z.toJSONSchema`) with a
 * `git diff --exit-code` freshness gate in CI — mirrors `@la/lang-ar`'s
 * `ar-annotations.schema.json` pipeline exactly.
 *
 * Field set per `docs/plans/chinese-instance-design.md` §3.2/§7.1: two
 * pinyin layers (citation + surface, per SYLLABLE — i.e. per character in
 * v0, since v0 ships no erhua), per-CHARACTER ruby units
 * (`perCharacter[]`: `char`, `citationPinyinChar`, `compositionalBoundFlag`
 * — the click-breakdown/bound-morpheme-suppression slot, §6.8), a tone
 * TRACK stored separately from the segmental body (§3.5's character-borne
 * tone cue needs the tone digit even after the segmental pinyin has faded
 * to zero opacity), and first-class `neutralToneSlots`/`erhuaSlots`
 * structured slots (§3.2: "erhua fuses into the preceding syllable...
 * there is no clean per-glyph ruby for the fused syllable, so the SLOT,
 * not the alignment, carries it" — v0 ships zero erhua occurrences per
 * #20's C6 sliver-curation constraint, so `erhuaSlots` is always `[]`
 * today, but the shape does not preclude it).
 *
 * `spanGroupId` is FORWARD-DECLARED but v0-UNUSED: Decision 3 of the
 * dual-instance amendment strikes 離合詞 (separable-verb discontinuous
 * spans) from the zh v0 probe set — #20's C6 curation constraint excludes
 * 離合詞 from the seed sliver entirely — so this pack never emits the
 * field. It exists so the TYPE does not have to change shape when a future
 * separable-verb-expansion child re-introduces spanGroup coverage
 * (mirroring the contract's own `TokenSpine.spanGroup?` optionality).
 *
 * `boundMorpheme` mirrors design §6.8's "bound | compositional" flag:
 * transliteration/bound morphemes (葡萄, 沙發) suppress the per-character
 * gloss in the breakdown panel. v0's 58-word sliver contains no such
 * entries, so this pack always emits `false`, but the shape is present so
 * a future sliver expansion is a data change, not a schema change.
 *
 * Real-wire mapping note: the real `src/sidecars/zh` v0 gate's
 * `/v1/verify` response carries a much THINNER per-token payload (plain
 * `citationPinyin`/`surfacePinyin` string arrays, `pos`/`senseId`/`gloss`
 * for word-kind tokens, `contextKey`/`rule` for single-kind tokens, `{}`
 * for punct/digit, `{reason}` for RED — see `src/sidecars/zh/app/gate.py`
 * `_payload()`). `gate.ts` (seam 1) is where the enrichment happens: it
 * zips the wire's flat pinyin arrays against the token's own surface
 * characters to mint `perCharacter[]`, derives `toneTrack`/
 * `neutralToneSlots` from the surface-pinyin tone marks, and fills
 * `boundMorpheme`/`erhuaSlots`/`spanGroupId` with their v0-constant
 * values — exactly the same "pack enriches the thin wire shape into its
 * own richer canonical annotation" pattern `@la/lang-ar`'s gate uses for
 * `morphology`.
 */

import { z } from "zod";

/**
 * Versioned schema id declared by every emitted envelope (`schemaId`).
 * Bumping it invalidates every cached/stored payload under the old id —
 * cached annotation payloads are RE-DERIVABLE, never migrated (ADR §3.5).
 */
export const ZH_ANNOTATIONS_SCHEMA_ID = "zh-annotations/v1";

/**
 * One ruby unit: one Traditional character plus its citation reading (for
 * the click-breakdown panel / "known" accounting) and the bound-morpheme
 * suppression flag. This is the Latent-C gating unit (design §2.2/§3.1) —
 * the ruby band renders PER CHARACTER, not per token, because "an opaque
 * glyph has no sound-it-out fallback."
 */
export const ZhCharacterUnitSchema = z.strictObject({
  /** Exactly one Traditional Han character (surface order). */
  char: z.string().min(1),
  /** Citation (dictionary/isolation) reading for THIS character —
   * tone-mark form, e.g. `kě`. Drives the click-breakdown panel and the
   * Latent-C "known" accounting; never the display path (§3.2/§3.3: the
   * ruby band always renders the SURFACE layer). */
  citationPinyinChar: z.string().min(1),
  /** Suppresses the per-character gloss in the breakdown panel for
   * transliteration/bound morphemes (design §6.8: 葡萄, 沙發 — a
   * standalone per-character gloss would teach a fake meaning). v0's
   * sliver contains no such entries; always `false` today. */
  compositionalBoundFlag: z.boolean(),
});
export type ZhCharacterUnit = z.infer<typeof ZhCharacterUnitSchema>;

/**
 * The per-token Chinese annotation payload. Strict on purpose: an unknown
 * key is a schema violation, not silently-accepted drift (mirrors
 * `ArAnnotationsSchema`; the generated JSON Schema artifact carries
 * `additionalProperties: false`).
 *
 * Every field defaults to "empty" for non-linguistic tokens (punctuation,
 * digits, RED/regenerate-candidate tokens) — the real sidecar's wire
 * payload is `{}` for those kinds, so `gate.ts` maps them to the empty
 * shape below rather than omitting the envelope (mirrors `@la/lang-ar`'s
 * degenerate punctuation `morphology`).
 */
export const ZhAnnotationsSchema = z.strictObject({
  /** The mastery key (design §7.1 `reading_id`) — present ONLY for
   * word-kind tokens; C3 single-kind tokens (的/了/不/一/嗎/呢) and
   * non-linguistic tokens carry no word-level reading identity. */
  readingId: z.string().min(1).optional(),
  /** One entry per Traditional character, in surface order — the ruby
   * band's per-character unit. Empty for punct/digit/RED tokens. */
  perCharacter: z.array(ZhCharacterUnitSchema),
  /** Per-SYLLABLE citation (isolation/dictionary) reading, tone-mark form
   * — index-aligned with `perCharacter` in v0 (no erhua fusion shipped).
   * Drives accounting and the click-breakdown, never the display path. */
  citationPinyin: z.array(z.string().min(1)),
  /** Per-SYLLABLE surface (sandhi/neutral-tone/erhua-resolved) reading,
   * tone-mark form. Drives the ruby band AND TTS (never dictionary
   * membership-checked — design §3.2/§3.4). Fade-by-subtraction (§3.3)
   * operates on THIS layer. */
  surfacePinyin: z.array(z.string().min(1)),
  /** The tone sub-track (design §3.1 dim 3, §3.5): tone digits (1–5, 5 =
   * neutral) derived from `surfacePinyin`, stored SEPARATELY from the
   * segmental body so the character-borne late-tone-state cue (§3.5) can
   * still paint a tone after the segmental ruby has faded to zero
   * opacity — a tone mark cannot outlive its vowel, so the digit must be
   * available independent of the pinyin string. Index-aligned with
   * `surfacePinyin`. */
  toneTrack: z.array(z.number().int().min(1).max(5)),
  /** Indices into `surfacePinyin`/`toneTrack` carrying neutral tone (tone
   * 5) — a first-class structured slot per design §3.2/§7.1, not a string
   * hack (`toneTrack[i] === 5` is the equivalent predicate; this array is
   * the pre-computed convenience the renderer consumes directly). */
  neutralToneSlots: z.array(z.number().int().nonnegative()),
  /** Indices where 兒 erhua fusion collapses into the PRECEDING syllable
   * (design §3.2/§3.4: "the slot, not the alignment, carries it"). v0
   * ships zero erhua occurrences (#20's C6 sliver constraint) — always
   * `[]` today; the slot exists so the shape survives a future erhua
   * expansion without a schema break. */
  erhuaSlots: z.array(z.number().int().nonnegative()),
  /** Part of speech, word-kind only. */
  pos: z.string().min(1).optional(),
  /** The intended sense id, word-kind only — what the intent cross-check
   * leg keys on (`src/sidecars/zh/app/legs/intent.py`). */
  senseId: z.string().min(1).optional(),
  /** English gloss, word-kind only. */
  gloss: z.string().min(1).optional(),
  /** The `(char, prev, next)` C9 context key, single-kind only —
   * traceable back to the curated enumeration
   * (`src/packages/lang-zh/assets/c9-context-table.json`) a given
   * occurrence's pinned reading came from. */
  contextKey: z.string().min(1).optional(),
  /** The named sandhi/tone-shift rule applied, when one was (single-kind
   * occurrences only, e.g. `tone-shift-before-4`, `ordinal-date`). */
  rule: z.string().min(1).optional(),
  /** Whole-token bound-morpheme flag (design §6.8) — mirrors the
   * per-character `compositionalBoundFlag` at the word level. v0's
   * sliver has no transliteration entries; always `false` today. */
  boundMorpheme: z.boolean(),
  /** Forward-declared, v0-UNUSED 離合詞 discontinuous-span slot (see file
   * header) — never emitted; present only so the type does not change
   * shape when 離合詞 coverage lands. Mirrors the contract's own
   * `TokenSpine.spanGroup?`. */
  spanGroupId: z.string().min(1).optional(),
  /** Present only on a RED (withheld) token: the gate's `red_reason`
   * (`out-of-world`, `corrupt`, `membership-miss`) or, for a
   * candidate-level regenerate response, the regenerate reason. Mirrors
   * `@la/lang-ar`'s degenerate RED `morphology` — the token stays
   * addressable and schema-valid even when withheld. */
  redReason: z.string().min(1).optional(),
});
export type ZhAnnotations = z.infer<typeof ZhAnnotationsSchema>;
