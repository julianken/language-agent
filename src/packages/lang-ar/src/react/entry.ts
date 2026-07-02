/**
 * The `ar` renderer registry entrant — seam 6 (ADR §1.3 port 6): the
 * `RendererManifest` keys `(lang, token.kind)` into the client component
 * registry; the shared shell imports ZERO language components — the app's
 * composition layer registers this whole entry.
 *
 * The full `LanguagePack` export (all nine seams) is #9's wiring; this
 * module owns only the seam-6 half #10 needs.
 */

import type { RendererManifest } from "@la/contract";
import { ArMessageContainer } from "./ArMessageContainer.js";
import { ArPunctToken, ArWordToken } from "./ArWordToken.js";
import type { RendererPackEntry } from "./renderer-types.js";

export const arRendererManifest: RendererManifest = {
  direction: "rtl",
  tokenRenderers: {
    word: "ar-word-token",
    punct: "ar-punct-token",
  },
  breakdownPanel: "ar-breakdown-panel",
};

export const arRendererEntry: RendererPackEntry = {
  lang: "ar",
  manifest: arRendererManifest,
  components: {
    "ar-word-token": ArWordToken,
    "ar-punct-token": ArPunctToken,
  },
  Container: ArMessageContainer,
  FallbackToken: ArPunctToken,
};
