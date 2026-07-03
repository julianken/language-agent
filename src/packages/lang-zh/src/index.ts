// @la/lang-zh — the Chinese (Traditional-script, Putonghua) language pack.
//
// v0 (issue #21): the full LanguagePack — all nine seams wired here or
// reused from #20's committed assets. The composition root's registry
// entry does `import('@la/lang-zh')` and reads `pack`.
export { pack } from "./pack.js";
export { zhAnnotationCodec } from "./codec.js";
export { makeZhGate, enrichZhAnnotations } from "./gate.js";
export { makeZhSteering } from "./steering.js";
export {
  ZH_FADE_DIMENSIONS,
  ZH_TARGET_BLEND_RATIO,
  hashRatioSelect,
  zhMasteryModel,
} from "./mastery.js";
export { zhCurriculumPolicy } from "./curriculum.js";
export { toneOfDisplaySyllable } from "./pinyin-tone.js";
export {
  ZH_ANNOTATIONS_SCHEMA_ID,
  ZhAnnotationsSchema,
  ZhCharacterUnitSchema,
} from "./annotations.js";
export type {
  ZhAnnotations,
  ZhCharacterUnit,
} from "./annotations.js";
