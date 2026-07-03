/**
 * Structural renderer types for the `@la/lang-fake/react` entrant — a
 * deliberate STRUCTURAL mirror of the shell's wire-token shape
 * (`src/apps/web/src/shell/stream-types.ts`) and of
 * `@la/lang-ar/react`'s `renderer-types.ts`. Packs never import the app
 * (cycle — ADR §2.4 rule d) and never import each other (drop-in
 * independence); TypeScript structural typing glues the copies together at
 * the registry boundary. Keep the three copies field-identical.
 */

import type { ScaffoldDirective, LearningEvent, RendererManifest } from "@la/contract";
import type { ComponentType, ReactNode } from "react";

export interface RenderedToken {
  id: string;
  text: string;
  lang: string;
  kind: string;
  status?: string;
  band?: "GREEN" | "YELLOW" | "RED";
  spanGroup?: string;
  annotations?: unknown;
  directive?: ScaffoldDirective;
}

export type LearningEventSink = (event: LearningEvent) => void;

export interface TokenRendererProps {
  token: RenderedToken;
  emitLearningEvent: LearningEventSink;
}

export interface RendererPackEntry {
  lang: string;
  manifest: RendererManifest;
  components: Record<string, ComponentType<TokenRendererProps>>;
  Container: ComponentType<{ children?: ReactNode }>;
  FallbackToken?: ComponentType<TokenRendererProps>;
}
