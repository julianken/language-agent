// @la/lang-ar — the Arabic language pack.
//
// v0: the full LanguagePack (issue #9, step 3b) — seams 1/2/4/5 wired here,
// seam 3's zod schema (#7) + seam 6's renderer manifest (#10) + seam 9's
// asset (#8) reused verbatim. The composition root's registry entry does
// `import('@la/lang-ar')` and reads `pack`.
export { pack } from "./pack.js";
export { arAnnotationCodec } from "./codec.js";
export { makeArGate } from "./gate.js";
export { makeArSteering } from "./steering.js";
export { AR_FADE_DIMENSIONS, AR_TARGET_BLEND_RATIO, arMasteryModel } from "./mastery.js";
export { arCurriculumPolicy } from "./curriculum.js";
export {
  AR_ANNOTATIONS_SCHEMA_ID,
  ArAnnotationsSchema,
  ArMorphologySchema,
  ArVowelStateSchema,
} from "./annotations.js";
export type {
  ArAnnotations,
  ArMorphology,
  ArVowelState,
} from "./annotations.js";
