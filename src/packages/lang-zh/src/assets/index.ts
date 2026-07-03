// @la/lang-zh/assets — the seam-9 asset subpath export (issue #20's
// committed sliver; issue #21 supplies the zod spineSchema binding). Barrel
// for the three asset row schemas, the manifest entries, and the
// assets-root path helper.
export {
  ZhC9ContextEntrySchema,
  ZhC9ContextTableAssetSchema,
  ZhSeedTupleSchema,
  ZhSeedTuplesAssetSchema,
  ZhSegmenterNormalizationAssetSchema,
} from "./schema.js";
export type {
  ZhC9ContextEntry,
  ZhC9ContextTableAsset,
  ZhSeedTuple,
  ZhSeedTuplesAsset,
  ZhSegmenterNormalizationAsset,
} from "./schema.js";
export { zhAssetManifest } from "./manifest.js";
export { ZH_ASSETS_ROOT } from "./root.js";
