/**
 * The `@la/lang-fake` LanguagePack manifest — the permanent MAX-topology
 * drop-in fixture (ADR §4.3): a fake that shared only Arabic's shape would
 * prove nothing zh will actually break, so this pack is deliberately the
 * HARDEST topology the contract claims to support, fully deterministic and
 * dependency-free: re-segmenting gate, 2 unit kinds + 1 gating edge +
 * 1 declared credit-leak edge + 3 fade dimensions with per-unit fades
 * within a token, a discontinuous span group, and deterministic
 * YELLOW/RED cases.
 */

import { CONTRACT_VERSION, type LanguagePack, type TtsDriver } from "@la/contract";
import type { FakeAnn } from "./annotations.js";
import { fakeAnnotationCodec } from "./annotations.js";
import { LexiconSchema, SegmentationTableSchema } from "./assets-schema.js";
import { makeFakeGate } from "./gate.js";
import { fakeMasteryModel } from "./mastery.js";
import { makeFakeSteering } from "./steering.js";
import { fakeCurriculumPolicy } from "./curriculum.js";

const makeFakeTts = (): TtsDriver => ({
  /** Deterministic; input type `VerifiedToken[]` makes "TTS from
   * unverified text" unrepresentable (seam 7). */
  async synthesize(verified, voice) {
    return {
      format: "fake-tts/v1",
      content: `${voice.provider}/${voice.voice}: ${verified
        .map((t) => t.spine.surface)
        .join(" ")}`,
    };
  },
});

export const pack: LanguagePack<FakeAnn> = {
  meta: {
    lang: "fake",
    packageVersion: "0.1.0",
    contractVersion: CONTRACT_VERSION,
  },
  verificationGate: makeFakeGate, // seam 1
  steeringPolicy: makeFakeSteering, // seam 2
  annotationCodec: fakeAnnotationCodec, // seam 3
  masteryModel: fakeMasteryModel, // seam 4
  curriculumPolicy: fakeCurriculumPolicy, // seam 5
  rendererManifest: {
    // seam 6 — LTR with per-glyph hint scaffolds (the structural-swap
    // second registry entrant; the components these keys resolve to live
    // under ./react (issue #10) — keep src/react/entry.ts in lockstep).
    direction: "ltr",
    tokenRenderers: { word: "fake-word-token" },
    breakdownPanel: "fake-breakdown-panel",
  },
  ttsDriver: makeFakeTts, // seam 7
  sidecarDescriptor: {
    // seam 8 — the fake runs entirely in-process (dependency-free,
    // ADR §4.3); the descriptor exists to exercise the seam's shape. The
    // live cross-check (`assertSidecarAgrees`) lands with #7.
    imageRef: "none:lang-fake-sidecarless",
    contractVersion: CONTRACT_VERSION,
    expectedLegs: ["lexicon-membership", "boundary-vote"],
  },
  assetManifest: {
    // seam 9 — the closed world lives in named, spine-schema'd assets the
    // gate reads through the scoped PackContext reader.
    assets: {
      lexicon: { path: "lexicon.json", spineSchema: LexiconSchema },
      "segmentation-table": {
        path: "segmentation-table.json",
        spineSchema: SegmentationTableSchema,
      },
    },
  },
};
