/**
 * The `zh` renderer registry entrant — seam 6 (ADR §1.3 port 6): the
 * `RendererManifest` keys `(lang, token.kind)` into the client component
 * registry; the shared shell imports ZERO language components — the app's
 * composition layer registers this whole entry
 * (`src/apps/web/src/packs/register.ts`).
 *
 * The full `LanguagePack` export (all nine seams) is `pack.ts`'s wiring;
 * this module owns only the seam-6 half the web app needs. `zhRendererManifest`
 * itself is re-exported from `./manifest.js` (one source, zero React
 * imports) — see that file's header for why `pack.ts` must not import the
 * React components this file also pulls in.
 */

import { ZhMessageContainer } from "./ZhMessageContainer.js";
import { ZhPunctToken, ZhWordToken } from "./ZhWordToken.js";
import { zhRendererManifest } from "./manifest.js";
import type { RendererPackEntry } from "./renderer-types.js";

export { zhRendererManifest } from "./manifest.js";

export const zhRendererEntry: RendererPackEntry = {
  lang: "zh",
  manifest: zhRendererManifest,
  components: {
    "zh-word-token": ZhWordToken,
    "zh-punct-token": ZhPunctToken,
  },
  Container: ZhMessageContainer,
  FallbackToken: ZhPunctToken,
};
