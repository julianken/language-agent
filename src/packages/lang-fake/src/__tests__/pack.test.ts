import { describe, expect, it } from "vitest";
import {
  CONTRACT_VERSION,
  PackManifestSchema,
  deriveCapabilities,
} from "@la/contract";
import { pack } from "../pack.js";
import { fakeCurriculumPolicy } from "../curriculum.js";
import { makeTestContext, TURN } from "./test-context.js";

describe("lang-fake pack manifest", () => {
  it("is a well-formed LanguagePack per the contract's manifest schema", () => {
    expect(PackManifestSchema.safeParse(pack).success).toBe(true);
  });

  it("pins meta.contractVersion to the tree's CONTRACT_VERSION (boot equality assert)", () => {
    expect(pack.meta.contractVersion).toBe(CONTRACT_VERSION);
    expect(pack.meta.lang).toBe("fake");
  });

  it("derives the MAX-topology capabilities from the ports", () => {
    expect(deriveCapabilities(pack)).toEqual({
      direction: "ltr",
      masteryUnitKinds: ["word", "glyph"],
      fadeDimensions: ["meaning", "glyphHint", "stressMark"],
      gatingEdges: [{ gatingUnitKind: "glyph", gatedDimension: "glyphHint" }],
      creditLeakEdges: [
        { evidenceDimension: "meaning", leakingDimension: "glyphHint" },
      ],
      coverageFloorIds: ["nonempty-stream", "green-majority"],
      sidecarImage: "none:lang-fake-sidecarless",
      requiredDataAssets: ["lexicon", "segmentation-table"],
    });
  });
});

describe("lang-fake curriculum", () => {
  it("declares two floors, both pure over the FULL candidate token stream", async () => {
    const { makeFakeGate } = await import("../gate.js");
    const gate = makeFakeGate(makeTestContext());
    const stream = (
      await gate.verify({ targetText: "zip blen qux", intents: [] }, TURN)
    ).map((t) => t.spine);
    const snapshot = { userId: "u1" };
    const [nonempty, greenMajority] = fakeCurriculumPolicy.floors;
    expect(nonempty?.satisfied(stream, snapshot)).toBe(true);
    // 1 GREEN of 3 → not a majority.
    expect(greenMajority?.satisfied(stream, snapshot)).toBe(false);
    expect(greenMajority?.satisfied([], snapshot)).toBe(true);
  });

  it("supplies deterministic seed candidates", () => {
    const policy = fakeCurriculumPolicy.make(makeTestContext());
    expect(policy.candidates({ userId: "u1" }, "any-topic")).toEqual([
      { unit: { kind: "word", id: "zip" } },
      { unit: { kind: "word", id: "zap" } },
      { unit: { kind: "word", id: "zorg" } },
    ]);
    expect(policy.floors.map((f) => f.id)).toEqual(
      fakeCurriculumPolicy.floors.map((f) => f.id),
    );
  });
});

describe("lang-fake tts", () => {
  it("synthesizes only from gate-verified tokens, deterministically", async () => {
    const { makeFakeGate } = await import("../gate.js");
    const ctx = makeTestContext();
    const gate = makeFakeGate(ctx);
    const verified = await gate.verify(
      { targetText: "wug bo zip", intents: [] },
      TURN,
    );
    const tts = pack.ttsDriver(ctx);
    const payload = await tts.synthesize(verified, {
      provider: "fake",
      voice: "v1",
    });
    expect(payload).toEqual({
      format: "fake-tts/v1",
      content: "fake/v1: wug bo zip",
    });
  });
});
