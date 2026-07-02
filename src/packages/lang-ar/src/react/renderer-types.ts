/**
 * Structural renderer types for the `@la/lang-ar/react` entrant.
 *
 * These mirror the shell's wire-token shape (`src/apps/web/src/shell/
 * stream-types.ts`) STRUCTURALLY, on purpose: a pack must never import the
 * app (`@la/web`) — that would put an app → pack → app cycle into the
 * dependency graph (ADR §2.4 rule d) — and `@la/contract` deliberately
 * carries no React-facing wire type at v0. TypeScript's structural typing
 * is the glue: the shell's registry accepts any component whose props are
 * shape-compatible with its own `TokenRendererProps`.
 *
 * The token shape follows `docs/plans/architecture.md` §3 (`id`, `text`,
 * `lang`, `kind` required; everything else lazily hydrated) with the
 * contract spine's names for the shared slots (`status`, `band`,
 * `spanGroup` — ADR §1.5 SSE schema) and the per-token stamped
 * `ScaffoldDirective` envelope (ADR §1.4).
 */

import type { ScaffoldDirective, LearningEvent, RendererManifest } from "@la/contract";
import type { ComponentType, ReactNode } from "react";

/** One streamed token as the renderer sees it (annotations still opaque —
 * pack components decode them with their own canonical zod schema). */
export interface RenderedToken {
  id: string;
  text: string;
  /** Per-token language tag — the blend made concrete (architecture.md §3:
   * `count(lang==target)/total` is measured off this field). Opaque here;
   * the registry keys on it. */
  lang: string;
  kind: string;
  status?: string;
  band?: "GREEN" | "YELLOW" | "RED";
  spanGroup?: string;
  annotations?: unknown;
  directive?: ScaffoldDirective;
}

/** The shared learning-event return channel (contract `LearningEvent`,
 * ADR §1.4) — the shell provides transport, the pack builds the event. */
export type LearningEventSink = (event: LearningEvent) => void;

export interface TokenRendererProps {
  token: RenderedToken;
  emitLearningEvent: LearningEventSink;
}

/** One pack's complete registry entrant: the seam-6 manifest plus the
 * concrete components its `ComponentKey`s resolve to. */
export interface RendererPackEntry {
  lang: string;
  manifest: RendererManifest;
  /** ComponentKey → component, for every key named in
   * `manifest.tokenRenderers`. The breakdown panel is composed INSIDE the
   * pack's own token component (pack UI), not rendered by the shell. */
  components: Record<string, ComponentType<TokenRendererProps>>;
  /** The pack container — direction (and any other script-structural
   * concern) is decided HERE, never by the shared shell (dual-instance
   * amendment: the shell sets no global `dir`). */
  Container: ComponentType<{ children?: ReactNode }>;
  /** Fallback for a `kind` with no manifest entry (still pack-rendered). */
  FallbackToken?: ComponentType<TokenRendererProps>;
}
