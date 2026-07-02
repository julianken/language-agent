/**
 * @la/lang-fake — the permanent MAX-topology drop-in fixture pack
 * (ADR §4.3). The composition root's registry entry does
 * `import('@la/lang-fake')` and reads `pack`.
 */

export { pack } from "./pack.js";
export { FAKE_ASSETS_ROOT } from "./assets-root.js";
export { FakeAnnSchema, fakeAnnotationCodec, glyphsOf } from "./annotations.js";
export type { FakeAnn } from "./annotations.js";
export {
  FakeEventPayloadSchema,
  GlyphStateSchema,
  WordStateSchema,
  fakeMasteryDeclarations,
  fakeMasteryModel,
  migrateWordState,
} from "./mastery.js";
export type { GlyphState, WordState } from "./mastery.js";
export { LexiconSchema, SegmentationTableSchema } from "./assets-schema.js";
export type { LexiconRow, SegmentationTable } from "./assets-schema.js";
