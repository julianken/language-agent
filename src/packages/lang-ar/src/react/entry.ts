/**
 * The `ar` renderer registry entrant — seam 6 (ADR §1.3 port 6): the
 * `RendererManifest` keys `(lang, token.kind)` into the client component
 * registry; the shared shell imports ZERO language components — the app's
 * composition layer registers this whole entry.
 *
 * The full `LanguagePack` export (all nine seams) is #9's wiring; this
 * module owns only the seam-6 half #10 needs. `arRendererManifest` itself
 * is re-exported from `./manifest.js` (one source, zero React imports) —
 * see that file's header for why `pack.ts` must not import the React
 * components this file also pulls in.
 */

import { ArMessageContainer } from "./ArMessageContainer.js";
import { ArPunctToken, ArWordToken } from "./ArWordToken.js";
import { arRendererManifest } from "./manifest.js";
import type { RendererPackEntry } from "./renderer-types.js";

export { arRendererManifest } from "./manifest.js";

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
