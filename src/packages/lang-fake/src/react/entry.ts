/**
 * The fake pack's registry entrant (seam 6). `pack.ts`'s rendererManifest
 * names these ComponentKeys; this module binds them to the real components
 * — the structural-swap proof entrant the registry exists for (ADR §5.2
 * #10). Kept as its own module so the node-only pack surface (`.`) stays
 * React-free; the app imports `@la/lang-fake/react`.
 */

import type { RendererManifest } from "@la/contract";
import { FakeMessageContainer, FakeWordToken } from "./FakeTokens.js";
import type { RendererPackEntry } from "./renderer-types.js";

/** Mirrors `pack.ts` → `rendererManifest` (seam 6) — same keys, plus the
 * concrete components. `pack.ts` stays the manifest's canonical home; this
 * re-declares it for the React-free/React-full split of the exports map. */
export const fakeRendererManifest: RendererManifest = {
  direction: "ltr",
  tokenRenderers: { word: "fake-word-token" },
  breakdownPanel: "fake-breakdown-panel",
};

export const fakeRendererEntry: RendererPackEntry = {
  lang: "fake",
  manifest: fakeRendererManifest,
  components: {
    "fake-word-token": FakeWordToken,
  },
  Container: FakeMessageContainer,
  FallbackToken: FakeWordToken,
};
