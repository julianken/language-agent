/**
 * The SHARED portable-stories suite (ADR §4.2, seam-6 "Renderer contract"
 * test category): ONE story file written against the contract — each band ×
 * fade stage × learner status, plus the per-unit split-fade state and the
 * discontinuous-span token — instantiated per language with that language's
 * fixture tokens (`PortableStoryLeg`, exported by each pack's `/react`
 * subpath). Renders through the REAL shell path (registry + TokenStream),
 * so a story exercises exactly what production renders.
 *
 * Visual snapshots stay per-language and live in the Playwright e2e run
 * (an RTL/LTR shared snapshot is meaningless — ADR §4.2); this suite owns
 * the structural assertions.
 */

import { renderToString } from "react-dom/server";
import type { Band, FadeLevel } from "@la/contract";
import { RendererRegistry, TokenStream } from "../shell/index.js";
import type { RendererRegistryEntry, WireToken } from "../shell/index.js";

/** Structural mirror of the legs the packs export (see the packs'
 * `renderer-types.ts` for why this is mirrored, not imported). */
export interface PortableStoryLeg {
  lang: string;
  entry: RendererRegistryEntry;
  statuses: string[];
  makeToken(band: Band, level: FadeLevel, status: string): WireToken;
  splitFade: {
    tokens: WireToken[];
    expectRendered: string[];
    forbidRendered: string[];
  };
  discontinuousSpan: { tokens: WireToken[]; spanGroup: string };
  expect: {
    containerDir: "rtl" | "ltr";
    bidiIsolatedTokens: boolean;
    usesRuby: boolean;
  };
}

export const BANDS: Band[] = ["GREEN", "YELLOW", "RED"];
export const LEVELS: FadeLevel[] = ["full", "partial", "faded"];

export interface StoryRender {
  name: string;
  tokens: WireToken[];
  html: string;
  /** Matrix-cell coordinates when applicable. */
  band?: Band;
  level?: FadeLevel;
  status?: string;
}

function renderLine(leg: PortableStoryLeg, tokens: WireToken[]): string {
  const registry = new RendererRegistry();
  registry.register(leg.entry);
  return renderToString(
    <TokenStream
      messageLang={leg.lang}
      tokens={tokens}
      registry={registry}
      emitLearningEvent={() => undefined}
    />,
  );
}

/** Every story state for one language leg. */
export function renderStories(leg: PortableStoryLeg): StoryRender[] {
  const stories: StoryRender[] = [];

  for (const band of BANDS) {
    for (const level of LEVELS) {
      for (const status of leg.statuses) {
        const token = leg.makeToken(band, level, status);
        stories.push({
          name: `${leg.lang}/${band}/${level}/${status}`,
          tokens: [token],
          html: renderLine(leg, [token]),
          band,
          level,
          status,
        });
      }
    }
  }

  stories.push({
    name: `${leg.lang}/split-fade`,
    tokens: leg.splitFade.tokens,
    html: renderLine(leg, leg.splitFade.tokens),
  });

  stories.push({
    name: `${leg.lang}/discontinuous-span`,
    tokens: leg.discontinuousSpan.tokens,
    html: renderLine(leg, leg.discontinuousSpan.tokens),
  });

  return stories;
}
