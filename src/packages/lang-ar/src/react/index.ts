/**
 * `@la/lang-ar/react` — the Arabic renderer entrant (issue #10; seam 6,
 * ADR §1.3 port 6). The shared shell imports NOTHING from here; the app's
 * composition layer (`src/apps/web/src/packs/`) registers `arRendererEntry`
 * into the client component registry keyed `(lang, token.kind)`.
 */

export { ArMessageContainer } from "./ArMessageContainer.js";
export { ArWordToken, ArPunctToken, ambiguousFirstIsolate } from "./ArWordToken.js";
export { ArBreakdownPanel } from "./ArBreakdownPanel.js";
export type { ArBreakdownPanelProps } from "./ArBreakdownPanel.js";
export { arRendererEntry, arRendererManifest } from "./entry.js";
export {
  AR_LEMMA_UNIT_KIND,
  AR_VOWEL_DIMS,
  arLemmaUnitRef,
  classifyMarks,
  renderVowels,
  renderedScaffoldEcho,
  unitRefsFrom,
  vowelLevelsFrom,
} from "./harakat.js";
export type { HarakahClass, VowelLevels } from "./harakat.js";
export type {
  LearningEventSink,
  RenderedToken,
  RendererPackEntry,
  TokenRendererProps,
} from "./renderer-types.js";
export { arPortableStoryLeg } from "./story-leg.js";
export type { PortableStoryLeg } from "./story-leg.js";
