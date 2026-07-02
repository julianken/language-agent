import { describe, expect, it } from "vitest";
import { deriveCapabilities } from "../derive-capabilities.js";
import { makeMinimalPack } from "./minimal-pack.js";

describe("deriveCapabilities", () => {
  it("derives every capability fact from the ports — one source each (ADR §2.2)", () => {
    const caps = deriveCapabilities(makeMinimalPack());
    expect(caps).toEqual({
      direction: "ltr",
      masteryUnitKinds: ["word", "glyph"],
      fadeDimensions: ["meaning", "glyphHint"],
      gatingEdges: [{ gatingUnitKind: "glyph", gatedDimension: "glyphHint" }],
      creditLeakEdges: [
        { evidenceDimension: "meaning", leakingDimension: "glyphHint" },
      ],
      coverageFloorIds: ["nonempty"],
      sidecarImage: "none:minimal",
      requiredDataAssets: ["lexicon"],
    });
  });

  it("is pure — same pack in, same capabilities out, no mutation", () => {
    const pack = makeMinimalPack();
    const a = deriveCapabilities(pack);
    const b = deriveCapabilities(pack);
    expect(a).toEqual(b);
    // Returned arrays are copies: mutating them must not reach the pack.
    a.fadeDimensions.push("tampered");
    expect(pack.masteryModel.declarations.fadeDimensions).toEqual([
      "meaning",
      "glyphHint",
    ]);
  });
});
