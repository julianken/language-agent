/**
 * The `@la/lang-ar` `LanguagePack` manifest v0 (issue #9, step 3b — "the
 * pack manifest ships COMPLETE in this issue"): all nine seams. Seams 1–5
 * are wired here; seam 6 (`rendererManifest`) and its `/react` components
 * are #10's (already merged — reused verbatim); seam 9's asset is #8's
 * (already merged — reused verbatim); seam 7 (`ttsDriver`) is a canned stub
 * per the epic's own scope-out ("Stubbed: ... TTS driver (interface only,
 * canned payload)").
 *
 * `arRendererManifest` is imported from `./react/manifest.js`, NOT
 * `./react/entry.js` — `entry.js` also imports the actual React component
 * modules, which side-effect-import `@fontsource/amiri/400.css`; that import
 * crashes under plain Node ESM (no CSS loader), exactly where this module
 * loads: the server's `composeApp` (issue #9 fix; see `manifest.ts`'s
 * header for the full explanation).
 */

import { CONTRACT_VERSION, type LanguagePack, type TtsDriver } from "@la/contract";
import { arAnnotationCodec } from "./codec.js";
import type { ArAnnotations } from "./annotations.js";
import { arCurriculumPolicy } from "./curriculum.js";
import { makeArGate } from "./gate.js";
import { arMasteryModel } from "./mastery.js";
import { makeArSteering } from "./steering.js";
import { arAssetManifest } from "./assets/manifest.js";
import { arRendererManifest } from "./react/manifest.js";

/** Seam 8: the real ar sidecar image ref, mirroring `compose.yaml`'s
 * `sidecar-ar` service and `src/sidecars/ar/app/contractmeta.py`'s declared
 * legs. Declaration-only — `composeApp`'s live `assertSidecarAgrees` cross-
 * check (`/v1/capabilities`) exercises the actual deployed image; provisioning
 * the image itself is #11's Terraform work. */
const arSidecarDescriptor = {
  imageRef: "language-agent/sidecar-ar:dev",
  contractVersion: CONTRACT_VERSION,
  expectedLegs: ["dediac-roundtrip", "camel-morph"],
};

/** Seam 7 stub: canned payload only, per the epic's explicit scope-out.
 * Input type `VerifiedToken[]` still makes "TTS from unverified text"
 * unrepresentable even in the stub. */
const makeArTts = (): TtsDriver => ({
  async synthesize(verified, voice) {
    return {
      format: "ar-tts-stub/v1",
      content: `${voice.provider}/${voice.voice}: ${verified.map((t) => t.spine.surface).join(" ")}`,
    };
  },
});

export const pack: LanguagePack<ArAnnotations> = {
  meta: {
    lang: "ar",
    packageVersion: "0.1.0",
    contractVersion: CONTRACT_VERSION,
  },
  verificationGate: makeArGate, // seam 1
  steeringPolicy: makeArSteering, // seam 2
  annotationCodec: arAnnotationCodec, // seam 3
  masteryModel: arMasteryModel, // seam 4 — FixedRatioScaffold stand-in
  curriculumPolicy: arCurriculumPolicy, // seam 5 — SeedVocabBypassCurriculum stand-in
  rendererManifest: arRendererManifest, // seam 6 — #10's manifest, reused verbatim
  ttsDriver: makeArTts, // seam 7 — stub
  sidecarDescriptor: arSidecarDescriptor, // seam 8
  assetManifest: arAssetManifest, // seam 9 — #8's asset, reused verbatim
};
