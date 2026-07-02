/**
 * Seam 9 — the asset manifest (ADR §1.3 port 9).
 *
 * Curriculum tables, verified-tuple stores, seed vocab: shared spine
 * columns + language extension payload columns, NAMED. Text-shaped assets
 * live in-package; model-scale data lives in the sidecar image (hosting
 * ADR). Assets are git-versioned and baked into the image, so boot
 * validation checks EXISTENCE + SPINE-SCHEMA VALIDITY only — no checksums
 * (they defend against nothing git+Docker don't already guarantee, and
 * return only if an asset is ever fetched rather than committed — ADR §6).
 */

import type { z } from "zod";

/** Pack-chosen asset name, unique within the pack's manifest. */
export type AssetId = string;

export interface AssetManifest {
  assets: Record<
    AssetId,
    {
      /** Path relative to the instance's configured `assetsRoot`. */
      path: string;
      /** Validates the PARSED asset content at boot (existence +
       * spine-schema validity — ADR §2.3 `assertAssetsPresent`). Packs
       * declare `z.array(rowSchema)` for row-shaped assets. */
      spineSchema: z.ZodType;
    }
  >;
}
