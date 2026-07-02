/**
 * Test-only minimal well-formed `LanguagePack` for the contract's OWN unit
 * tests. Deliberately in-package and tiny: the contract has ZERO workspace
 * deps (ADR §2.4 rule c), so its tests cannot import `@la/lang-fake` — the
 * MAX-topology fixture lives there and is exercised by its own suite and
 * the server's boot integration test.
 */

import { z } from "zod";
import { CONTRACT_VERSION } from "../version.js";
import type { LanguagePack } from "../language-pack.js";
import type { MasteryModel } from "../mastery.js";

export function makeMinimalPack(): LanguagePack {
  const declarations = {
    unitKinds: [
      {
        kind: "word",
        stateSchema: z.object({ seen: z.number() }),
        stateVersion: 1,
      },
      {
        kind: "glyph",
        stateSchema: z.object({ p: z.number() }),
        stateVersion: 1,
      },
    ],
    fadeDimensions: ["meaning", "glyphHint"],
    gatingEdges: [{ gatingUnitKind: "glyph", gatedDimension: "glyphHint" }],
    creditLeakEdges: [
      { evidenceDimension: "meaning", leakingDimension: "glyphHint" },
    ],
  };
  const masteryModel: MasteryModel = {
    ...declarations,
    unitsForToken: () => [],
    affectedUnits: () => [],
    applyEvidence: () => [],
    scaffoldPlan: () => ({
      fadeLevels: [],
      blend: { anglicize: false },
      dueness: { dueNow: false },
    }),
    dueUnits: () => [],
  };
  return {
    meta: {
      lang: "fake",
      packageVersion: "0.0.0",
      contractVersion: CONTRACT_VERSION,
    },
    verificationGate: () => ({
      verify: async () => [],
    }),
    steeringPolicy: () => ({
      generationConstraints: () => ({ instructions: [] }),
      anglicizeDown: (stream) => ({
        segments: stream.map((token) => ({ kind: "target" as const, token })),
      }),
    }),
    annotationCodec: {
      schema: z.unknown(),
      schemaId: "minimal-annotations/v1",
      encode: (a) => a,
      decode: (a) => a,
    },
    masteryModel: {
      declarations,
      make: () => masteryModel,
    },
    curriculumPolicy: {
      floors: [{ id: "nonempty", satisfied: (stream) => stream.length > 0 }],
      make: (ctx) => ({
        floors: [{ id: "nonempty", satisfied: (stream) => stream.length > 0 }],
        candidates: () => [],
      }),
    },
    rendererManifest: {
      direction: "ltr",
      tokenRenderers: { word: "minimal-word" },
      breakdownPanel: "minimal-breakdown",
    },
    ttsDriver: () => ({
      synthesize: async (verified) => ({
        format: "minimal-tts/v1",
        content: verified.map((t) => t.spine.surface).join(" "),
      }),
    }),
    sidecarDescriptor: {
      imageRef: "none:minimal",
      contractVersion: CONTRACT_VERSION,
      expectedLegs: ["minimal-leg"],
    },
    assetManifest: {
      assets: {
        lexicon: { path: "lexicon.json", spineSchema: z.array(z.unknown()) },
      },
    },
  };
}
