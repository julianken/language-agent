import { describe, expect, it } from "vitest";
import { makeFakeGate } from "../gate.js";
import { makeTestContext, TURN } from "./test-context.js";

const gate = makeFakeGate(makeTestContext());
const verify = (text: string) =>
  gate.verify({ targetText: text, intents: [] }, TURN);

describe("lang-fake gate — re-segmentation (AC: boundaries differ from naive whitespace split)", () => {
  it("merges `wug bo` (two naive chunks) into ONE token", async () => {
    const tokens = await verify("wug bo zip");
    expect(tokens.map((t) => t.spine.surface)).toEqual(["wug bo", "zip"]);
    // Naive split would be 3 chunks; the gate returns 2 tokens.
    expect("wug bo zip".split(/\s+/)).toHaveLength(3);
    expect(tokens).toHaveLength(2);
    expect(tokens[0]?.annotations.lexemeId).toBe("wugbo");
    expect(tokens[0]?.band).toBe("GREEN");
  });

  it("splits `frobnub` (one naive chunk) into TWO tokens", async () => {
    const tokens = await verify("frobnub");
    expect("frobnub".split(/\s+/)).toHaveLength(1);
    expect(tokens.map((t) => t.spine.surface)).toEqual(["frob", "nub"]);
    expect(tokens.every((t) => t.band === "GREEN")).toBe(true);
  });

  it("is deterministic — same text in, same stream out", async () => {
    const a = await verify("wug bo frobnub mip zorg tok");
    const b = await verify("wug bo frobnub mip zorg tok");
    expect(a).toEqual(b);
  });
});

describe("lang-fake gate — discontinuous span group (AC: ≥1 discontinuous spanGroup)", () => {
  it("mints one span group across NON-ADJACENT `mip … tok` tokens", async () => {
    const tokens = await verify("mip zorg tok");
    const [mip, zorg, tok] = tokens;
    expect(mip?.spine.spanGroup).toBeDefined();
    expect(mip?.spine.spanGroup).toBe(tok?.spine.spanGroup);
    expect(zorg?.spine.spanGroup).toBeUndefined();
    // Both halves map onto the ONE compound learnable unit.
    expect(mip?.annotations.lexemeId).toBe("miptok");
    expect(tok?.annotations.lexemeId).toBe("miptok");
    // And they are non-adjacent: a token sits between them.
    expect(tokens.map((t) => t.spine.surface)).toEqual(["mip", "zorg", "tok"]);
  });
});

describe("lang-fake gate — deterministic YELLOW and RED (AC)", () => {
  it("bands `blen` YELLOW via a failing boundary-vote leg", async () => {
    const tokens = await verify("blen");
    expect(tokens[0]?.band).toBe("YELLOW");
    expect(tokens[0]?.spine.band).toBe("YELLOW");
    const vote = tokens[0]?.evidence.find((e) => e.legId === "boundary-vote");
    expect(vote?.pass).toBe(false);
    const membership = tokens[0]?.evidence.find(
      (e) => e.legId === "lexicon-membership",
    );
    expect(membership?.pass).toBe(true);
  });

  it("bands an out-of-closed-world chunk RED via the lexicon-membership leg", async () => {
    const tokens = await verify("zip qux");
    expect(tokens[0]?.band).toBe("GREEN");
    expect(tokens[1]?.band).toBe("RED");
    const membership = tokens[1]?.evidence.find(
      (e) => e.legId === "lexicon-membership",
    );
    expect(membership?.pass).toBe(false);
  });

  it("keeps spine.band and VerifiedToken.band in agreement", async () => {
    const tokens = await verify("zip blen qux");
    for (const t of tokens) expect(t.spine.band).toBe(t.band);
  });
});

describe("lang-fake gate — annotations", () => {
  it("emits schema-valid annotations that round-trip through the codec", async () => {
    const { fakeAnnotationCodec } = await import("../annotations.js");
    const tokens = await verify("zip wug bo");
    for (const t of tokens) {
      const decoded = fakeAnnotationCodec.decode(
        fakeAnnotationCodec.encode(t.annotations),
      );
      expect(decoded).toEqual(t.annotations);
    }
  });

  it("decomposes a token into per-glyph hint scaffolds", async () => {
    const tokens = await verify("zip");
    expect(tokens[0]?.annotations.glyphs).toEqual([
      { glyph: "z", hint: "Z" },
      { glyph: "i", hint: "I" },
      { glyph: "p", hint: "P" },
    ]);
  });
});
