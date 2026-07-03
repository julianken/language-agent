/**
 * The seam-6 `RendererManifest` — pure DATA (keys only, ADR §1.3 port 6),
 * split out from `entry.ts` deliberately: `entry.ts` also imports the
 * actual React component modules, which side-effect-import
 * `@fontsource/noto-serif-tc/400.css` — fine in a bundled browser build,
 * but a hard CRASH under plain Node ESM (no CSS loader) — exactly where
 * `pack.ts` needs the manifest: the composition root's server-side
 * `composeApp` (mirrors `@la/lang-ar/src/react/manifest.ts`'s header
 * exactly — the same font-CSS-side-effect hazard, different font).
 *
 * Every non-linguistic / withheld token kind (`punct`, `digit`,
 * `unverified`, the candidate-level regenerate collapse's `candidate`
 * kind) maps to the same passthrough token component — never a ruby
 * renderer, since none of those carry per-character pinyin content.
 */

import type { RendererManifest } from "@la/contract";

export const zhRendererManifest: RendererManifest = {
  direction: "ltr",
  tokenRenderers: {
    word: "zh-word-token",
    single: "zh-word-token",
    punct: "zh-punct-token",
    digit: "zh-punct-token",
    unverified: "zh-punct-token",
    candidate: "zh-punct-token",
  },
  breakdownPanel: "zh-breakdown-panel",
};
