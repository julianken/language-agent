/**
 * @la/web shell — language-blind by construction (ADR §2.4 mechanism 4:
 * this path is lint/grep-gated against language conditionals, and issue
 * #10's gates additionally hold it free of any script-direction
 * vocabulary). It renders tokens generically through the `(lang, kind)`
 * registry; packs register their entrants from the app's composition
 * layer, never from here.
 */

export { RendererRegistry } from "./registry.js";
export type { RendererRegistryEntry } from "./registry.js";
export { TokenStream } from "./TokenStream.js";
export type { TokenStreamProps } from "./TokenStream.js";
export { useTokenStream } from "./useTokenStream.js";
export type { TokenStreamState } from "./useTokenStream.js";
export { makeLearningEventSink } from "./learning-events.js";
export type {
  LearningEventSink,
  TokenRendererProps,
  WireMessageMeta,
  WireToken,
} from "./stream-types.js";
