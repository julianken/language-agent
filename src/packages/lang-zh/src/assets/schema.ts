/**
 * `@la/lang-zh`'s seam-9 asset row schemas — the ROW/CONTENT schemas this
 * pack points its `assetManifest` entries' `spineSchema` at (contract
 * `AssetManifest`, `src/packages/contract/src/assets.ts`: `{ path,
 * spineSchema: z.ZodType }` is only the WRAPPER — content validation is
 * pack-owned, mirrors `@la/lang-ar/src/assets/schema.ts`).
 *
 * These schemas validate issue #20's COMMITTED, READ-ONLY assets
 * verbatim — `src/packages/lang-zh/assets/{seed-tuples,c9-context-table,
 * segmenter-normalization}.json` — never modified by this package (§9's
 * hard constraint). Shapes below were read directly off the committed
 * files, not invented.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// seed-tuples.json — the 58-word curated sliver (issue #20).
// ---------------------------------------------------------------------------

export const ZhSeedTupleSchema = z.strictObject({
  word: z.string().min(1),
  readingId: z.string().min(1),
  citationPinyin: z.array(z.string().min(1)).min(1),
  surfacePinyin: z.array(z.string().min(1)).min(1),
  pos: z.string().min(1),
  senseId: z.string().min(1),
  gloss: z.string().min(1),
  intentBearing: z.boolean(),
});
export type ZhSeedTuple = z.infer<typeof ZhSeedTupleSchema>;

export const ZhSeedTuplesAssetSchema = z.strictObject({
  provenance: z.string().min(1),
  note: z.string().min(1),
  variantMap: z.record(z.string(), z.string()),
  variantMapNote: z.string().min(1),
  tuples: z.array(ZhSeedTupleSchema).min(1),
});
export type ZhSeedTuplesAsset = z.infer<typeof ZhSeedTuplesAssetSchema>;

// ---------------------------------------------------------------------------
// c9-context-table.json — the C9 head-set context enumeration (issue #20).
// ---------------------------------------------------------------------------

export const ZhC9ContextEntrySchema = z.strictObject({
  char: z.string().min(1),
  prev: z.string().min(1),
  next: z.string().min(1),
  base: z.string().min(1),
  surface: z.string().min(1),
  note: z.string().min(1),
  rule: z.string().min(1).optional(),
});
export type ZhC9ContextEntry = z.infer<typeof ZhC9ContextEntrySchema>;

export const ZhC9ContextTableAssetSchema = z.strictObject({
  provenance: z.string().min(1),
  note: z.string().min(1),
  contextMarkers: z.strictObject({
    START: z.string().min(1),
    END: z.string().min(1),
    meaning: z.string().min(1),
  }),
  singles: z.array(z.string().min(1)).min(1),
  entries: z.array(ZhC9ContextEntrySchema).min(1),
});
export type ZhC9ContextTableAsset = z.infer<typeof ZhC9ContextTableAssetSchema>;

// ---------------------------------------------------------------------------
// segmenter-normalization.json — the jieba boundary-normalization map
// (issue #20).
// ---------------------------------------------------------------------------

export const ZhSegmenterNormalizationAssetSchema = z.strictObject({
  provenance: z.string().min(1),
  note: z.string().min(1),
  mappings: z.record(z.string(), z.array(z.string().min(1)).min(1)),
});
export type ZhSegmenterNormalizationAsset = z.infer<typeof ZhSegmenterNormalizationAssetSchema>;
