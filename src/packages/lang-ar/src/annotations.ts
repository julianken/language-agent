/**
 * `@la/lang-ar`'s canonical annotation ZOD SCHEMA — the `schema` half of
 * seam 3 (`AnnotationCodec<TAnn>`, ADR §1.3 port 3), and ONLY that half.
 *
 * Ownership (issue #7 plan-review resolution): the concrete ar payload
 * schema is born HERE — #16/contract-v0 owns only the generic port type
 * and envelopes; this schema types against them, it doesn't inherit a
 * concrete shape from them. The pack's TS `AnnotationCodec` encode/decode
 * halves are explicitly #9's pack wiring, NOT this module.
 *
 * This zod schema is the SINGLE canonical source (ADR §3.4): the sibling
 * `ar-annotations.schema.json` artifact is GENERATED from it
 * (`scripts/generate-annotation-schema.mjs`, via `z.toJSONSchema`) with a
 * `git diff --exit-code` freshness gate in CI — TS-side and sidecar-side
 * validation can never silently describe different shapes. On the wire the
 * payload rides the shared spec's generic `annotations` envelope as
 * `{ lang: "ar", schemaId: "ar-annotations/v1", payload }`; the shared
 * OpenAPI document itself carries no ar-named shape.
 *
 * Field set per ADR §3.4 ("diacritized form, bare skeleton, vowelState,
 * root+pattern") and docs/research/arabic-validation.md §6–§7: `diac` /
 * `skeleton` feed the dediac round-trip leg; `morphology` carries the
 * intended-sense tuple the analyzer-membership leg checks and the
 * breakdown panel renders; `vowelState` is the per-token vocalization-fade
 * slot (full → partial → none, by subtraction).
 */

import { z } from "zod";

/**
 * Versioned schema id declared by every emitted envelope (`schemaId`).
 * Bumping it invalidates every cached/stored payload under the old id —
 * cached annotation payloads are RE-DERIVABLE, never migrated (ADR §3.5).
 */
export const AR_ANNOTATIONS_SCHEMA_ID = "ar-annotations/v1";

/**
 * The vocalization-fade state of a token's rendered diacritics
 * (docs/research/arabic-validation.md §7 — "full → partial → none, by
 * subtraction").
 */
export const ArVowelStateSchema = z.enum(["full", "partial", "none"]);
export type ArVowelState = z.infer<typeof ArVowelStateSchema>;

/**
 * Root-and-pattern morphology for the breakdown panel and the
 * analyzer-membership gate leg (research §6: the intended lemma + gloss
 * fix the vocalization — intended-gloss → different diac than emitted ⇒
 * reject).
 */
export const ArMorphologySchema = z.strictObject({
  /** The intended lemma the analyzer-membership leg matched. */
  lemma: z.string().min(1),
  /** Dotted radical root, e.g. `ك.ت.ب`. */
  root: z.string().min(1),
  /** The morphological pattern the surface form realizes. */
  pattern: z.string().min(1),
  /** Part of speech, as emitted by the analyzer. */
  pos: z.string().min(1),
  /** The intended English sense — the gate's membership check keys on it. */
  gloss: z.string().min(1),
  /** CAPHI phonetic transcription (optional at v1). */
  caphi: z.string().min(1).optional(),
});
export type ArMorphology = z.infer<typeof ArMorphologySchema>;

/**
 * The per-token Arabic annotation payload. Strict on purpose: an unknown
 * key is a schema violation, not silently-accepted drift (the JSON Schema
 * artifact generates `additionalProperties: false` from this).
 */
export const ArAnnotationsSchema = z.strictObject({
  /** Fully vocalized (diacritized) form — the verified canonical surface. */
  diac: z.string().min(1),
  /** Bare undiacritized skeleton; `dediac(diac)` must equal it (leg 1). */
  skeleton: z.string().min(1),
  /** Vocalization-fade state for this token's rendering. */
  vowelState: ArVowelStateSchema,
  /** Root-and-pattern morphology (breakdown panel + gate leg 2). */
  morphology: ArMorphologySchema,
});
export type ArAnnotations = z.infer<typeof ArAnnotationsSchema>;
