/**
 * The seam-9 `AssetManifest` entries for this package's three committed,
 * read-only assets (issue #20) — ready for the full `@la/lang-zh`
 * `LanguagePack` to spread directly into its own manifest (mirrors
 * `@la/lang-ar/src/assets/manifest.ts`).
 */

import type { AssetManifest } from "@la/contract";
import {
  ZhC9ContextTableAssetSchema,
  ZhSeedTuplesAssetSchema,
  ZhSegmenterNormalizationAssetSchema,
} from "./schema.js";

export const zhAssetManifest: AssetManifest = {
  assets: {
    "seed-tuples": { path: "seed-tuples.json", spineSchema: ZhSeedTuplesAssetSchema },
    "c9-context-table": { path: "c9-context-table.json", spineSchema: ZhC9ContextTableAssetSchema },
    "segmenter-normalization": {
      path: "segmenter-normalization.json",
      spineSchema: ZhSegmenterNormalizationAssetSchema,
    },
  },
};
