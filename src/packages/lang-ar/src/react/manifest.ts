/**
 * The seam-6 `RendererManifest` — pure DATA (keys only, ADR §1.3 port 6),
 * split out from `entry.ts` deliberately: `entry.ts` also imports the
 * actual React component modules (`ArWordToken`, `ArMessageContainer`),
 * which in turn side-effect-import `@fontsource/amiri/400.css` — fine in a
 * bundled browser build, but a hard CRASH under plain Node ESM (no CSS
 * loader) — exactly where `pack.ts` needs the manifest: the composition
 * root's server-side `composeApp` (issue #9). This file has ZERO React
 * imports so `pack.ts` can depend on it without pulling the browser-only
 * chain into the server process. `entry.ts` re-exports this same object
 * (one source) for its own existing consumers (#10's `/react` subpath).
 */

import type { RendererManifest } from "@la/contract";

export const arRendererManifest: RendererManifest = {
  direction: "rtl",
  tokenRenderers: {
    word: "ar-word-token",
    punct: "ar-punct-token",
  },
  breakdownPanel: "ar-breakdown-panel",
};
