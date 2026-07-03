/**
 * The `@la/lang-zh` `LanguagePack` manifest v0 (issue #21): all nine seams.
 * Mirrors `@la/lang-ar/src/pack.ts`'s shape exactly.
 *
 * `zhRendererManifest` is imported from `./react/manifest.js`, NOT
 * `./react/entry.js` — `entry.js` also imports the actual React component
 * modules, which side-effect-import `@fontsource/noto-serif-tc/400.css`;
 * that import crashes under plain Node ESM (no CSS loader), exactly where
 * this module loads: the server's `composeApp` (same fix ar's #9 found and
 * applied — see `react/manifest.ts`'s header for the full explanation).
 */

import { CONTRACT_VERSION, type LanguagePack, type TtsDriver } from "@la/contract";
import { zhAnnotationCodec } from "./codec.js";
import type { ZhAnnotations } from "./annotations.js";
import { zhCurriculumPolicy } from "./curriculum.js";
import { makeZhGate } from "./gate.js";
import { zhMasteryModel } from "./mastery.js";
import { makeZhSteering } from "./steering.js";
import { zhAssetManifest } from "./assets/manifest.js";
import { zhRendererManifest } from "./react/manifest.js";

/** Seam 8: the real zh sidecar image ref, mirroring `compose.yaml`'s
 * `sidecar-zh` service. `expectedLegs` is the exact declared capability
 * list from `src/sidecars/zh/app/legs/__init__.py`'s `CAPABILITY_LEGS`
 * (order included — deterministic-legs-only v0, dual-instance amendment
 * Decision 1: g2pW/AS-HanLP/the jury run at curation time only, never in
 * this deployed image, so they are NOT named here). Declaration-only —
 * `composeApp`'s live `assertSidecarAgrees` cross-check (`/v1/capabilities`)
 * exercises the actual deployed image; provisioning the image itself is
 * infra work outside this issue's scope. */
const zhSidecarDescriptor = {
  imageRef: "language-agent/sidecar-zh:dev",
  contractVersion: CONTRACT_VERSION,
  expectedLegs: [
    "cedict-unihan-membership",
    "seed-closed-world",
    "headset-context-pinned",
    "sandhi-resolver",
    "segmenter-vote",
    "numeral-rule",
  ],
};

/** Seam 7 stub: canned payload only (this pack's scope stubs TTS, mirroring
 * ar's canned stub). Input type `VerifiedToken[]` still makes "TTS from
 * unverified text" unrepresentable even in the stub. */
const makeZhTts = (): TtsDriver => ({
  async synthesize(verified, voice) {
    return {
      format: "zh-tts-stub/v1",
      content: `${voice.provider}/${voice.voice}: ${verified.map((t) => t.spine.surface).join("")}`,
    };
  },
});

export const pack: LanguagePack<ZhAnnotations> = {
  meta: {
    lang: "zh",
    packageVersion: "0.1.0",
    contractVersion: CONTRACT_VERSION,
  },
  verificationGate: makeZhGate, // seam 1
  steeringPolicy: makeZhSteering, // seam 2
  annotationCodec: zhAnnotationCodec, // seam 3
  masteryModel: zhMasteryModel, // seam 4 — FixedRatioScaffold stand-in
  curriculumPolicy: zhCurriculumPolicy, // seam 5 — SeedVocabBypassCurriculum stand-in
  rendererManifest: zhRendererManifest, // seam 6
  ttsDriver: makeZhTts, // seam 7 — stub
  sidecarDescriptor: zhSidecarDescriptor, // seam 8
  assetManifest: zhAssetManifest, // seam 9 — #20's asset, wrapped here
};
