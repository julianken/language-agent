/**
 * `@la/lang-fake/react` — the fake pack's renderer entrant (issue #10).
 * The second, REAL registry entrant (never a passthrough): per-glyph hint
 * scaffolds with per-unit split fade, discontinuous-span linking, and the
 * deterministic YELLOW/RED states — the structural-swap proof for the
 * `(lang, kind)` registry.
 */

export { FakeMessageContainer, FakeWordToken } from "./FakeTokens.js";
export { fakeRendererEntry, fakeRendererManifest } from "./entry.js";
export { fakePortableStoryLeg } from "./story-leg.js";
export type { PortableStoryLeg } from "./story-leg.js";
export type {
  LearningEventSink,
  RenderedToken,
  RendererPackEntry,
  TokenRendererProps,
} from "./renderer-types.js";
