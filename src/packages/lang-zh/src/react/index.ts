/**
 * `@la/lang-zh/react` — the Chinese renderer entrant (seam 6, ADR §1.3
 * port 6). The shared shell imports NOTHING from here; the app's
 * composition layer (`src/apps/web/src/packs/register.ts`) registers
 * `zhRendererEntry` into the client component registry keyed
 * `(lang, token.kind)`.
 */

export { ZhMessageContainer } from "./ZhMessageContainer.js";
export { ZhWordToken, ZhPunctToken } from "./ZhWordToken.js";
export { ZhBreakdownPanel } from "./ZhBreakdownPanel.js";
export type { ZhBreakdownPanelProps } from "./ZhBreakdownPanel.js";
export { zhRendererEntry, zhRendererManifest } from "./entry.js";
export {
  ZH_CHARACTER_UNIT_KIND,
  ZH_FADE_DIMS,
  ZH_WORD_UNIT_KIND,
  buildRubySlots,
  renderRubyText,
  renderedScaffoldEcho,
  unitRefsFrom,
  withSegmentalLevels,
  zhCharacterUnitRef,
  zhCharacterUnitRefs,
  zhWordUnitRef,
} from "./ruby.js";
export type { RubySlot } from "./ruby.js";
export type {
  LearningEventSink,
  RenderedToken,
  RendererPackEntry,
  TokenRendererProps,
} from "./renderer-types.js";
export { zhPortableStoryLeg } from "./story-leg.js";
export type { PortableStoryLeg } from "./story-leg.js";
