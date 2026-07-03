/**
 * The seam-9 `AssetManifest` entry for this package's seed-vocab asset
 * (contract `AssetManifest`, `src/packages/contract/src/assets.ts`) —
 * ready for the full `@la/lang-ar` `LanguagePack` (#9/#10/#11's later
 * wiring, mirroring `@la/lang-fake`'s `pack.ts` `assetManifest` field) to
 * spread directly into its own manifest without re-declaring the path or
 * re-importing the schema.
 */

import type { AssetManifest } from "@la/contract";
import { ArSeedVocabSchema } from "./schema.js";

/** Asset id `seedVocab` resolves (relative to `AR_ASSETS_ROOT`) to the
 * committed `assets/seed-vocab.json` file. */
export const arAssetManifest: AssetManifest = {
  assets: {
    seedVocab: { path: "seed-vocab.json", spineSchema: ArSeedVocabSchema },
  },
};
