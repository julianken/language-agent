// @la/lang-ar/assets — the seam-9 asset subpath export (issue #8; the
// package.json description names this as one of the subpath exports #8
// owns, alongside the /react subpath #10 owns and the full LanguagePack
// #9 owns). Barrel for the seed-vocab row schema, the manifest entry, and
// the assets-root path helper.
export {
  ArSeedVocabRowSchema,
  ArSeedVocabSchema,
  ArSeedVocabTierSchema,
} from "./schema.js";
export type { ArSeedVocab, ArSeedVocabRow, ArSeedVocabTier } from "./schema.js";
export { arAssetManifest } from "./manifest.js";
export { AR_ASSETS_ROOT } from "./root.js";
