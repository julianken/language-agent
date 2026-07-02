import { describe, expect, it } from "vitest";
import type { ScaffoldDirective } from "@la/contract";
import { makeFakeGate } from "../gate.js";
import { makeFakeSteering } from "../steering.js";
import { makeTestContext, TURN } from "./test-context.js";

const ctx = makeTestContext();
const gate = makeFakeGate(ctx);
const steering = makeFakeSteering(ctx);

const anglicizeAll = (n: number): ScaffoldDirective[] =>
  Array.from({ length: n }, () => ({
    fadeLevels: [],
    blend: { anglicize: true },
    dueness: { dueNow: true },
  }));

describe("lang-fake steering — anglicizeDown laws (ADR §4.2)", () => {
  it("subtraction-safety: target segments are a subset of the input tokens (no target byte minted)", async () => {
    const stream = await gate.verify(
      { targetText: "zip zap zorg", intents: [] },
      TURN,
    );
    const blended = steering.anglicizeDown(stream, anglicizeAll(stream.length));
    const inputSurfaces = new Set(stream.map((t) => t.spine.surface));
    for (const seg of blended.segments) {
      if (seg.kind === "target") {
        expect(inputSurfaces.has(seg.token.spine.surface)).toBe(true);
      }
    }
    // Under anglicize-all directives with no allowlisted tokens, every
    // segment is English — and none of them contains target lexemes.
    expect(blended.segments.every((s) => s.kind === "english")).toBe(true);
  });

  it("allowlist inviolability: span-grouped tokens are NEVER anglicized, under any directives", async () => {
    const stream = await gate.verify(
      { targetText: "mip zorg tok", intents: [] },
      TURN,
    );
    const blended = steering.anglicizeDown(stream, anglicizeAll(stream.length));
    const [mip, zorg, tok] = blended.segments;
    expect(mip?.kind).toBe("target");
    expect(tok?.kind).toBe("target");
    expect(zorg?.kind).toBe("english");
  });

  it("frame preservation: segment order mirrors token order; non-anglicized tokens pass through unchanged", async () => {
    const stream = await gate.verify(
      { targetText: "zip zap zorg", intents: [] },
      TURN,
    );
    const directives = anglicizeAll(stream.length);
    // Only anglicize the middle token.
    (directives[0] as ScaffoldDirective).blend.anglicize = false;
    (directives[2] as ScaffoldDirective).blend.anglicize = false;
    const blended = steering.anglicizeDown(stream, directives);
    expect(blended.segments).toHaveLength(3);
    expect(blended.segments[0]).toEqual({ kind: "target", token: stream[0] });
    expect(blended.segments[1]).toEqual({
      kind: "english",
      text: "two",
      replaced: [{ kind: "word", id: "zap" }],
    });
    expect(blended.segments[2]).toEqual({ kind: "target", token: stream[2] });
  });

  it("is pure — same inputs, same output; missing directive means keep the target token", async () => {
    const stream = await gate.verify(
      { targetText: "zip zap", intents: [] },
      TURN,
    );
    const a = steering.anglicizeDown(stream, []);
    const b = steering.anglicizeDown(stream, []);
    expect(a).toEqual(b);
    expect(a.segments.every((s) => s.kind === "target")).toBe(true);
  });
});

describe("lang-fake steering — constraints and scoring", () => {
  it("generationConstraints is deterministic over the plan's intents", () => {
    const constraints = steering.generationConstraints({
      intents: [{ id: "greet", description: "say hi" }],
    });
    expect(constraints.instructions).toEqual([
      "fake: use only closed-lexicon words",
      "express: greet",
    ]);
  });

  it("scoreCandidate is deterministic", () => {
    const snapshot = { userId: "u1" };
    expect(steering.scoreCandidate?.({ text: "zip zap zorg" }, snapshot)).toBe(3);
    expect(steering.scoreCandidate?.({ text: "zip zap zorg" }, snapshot)).toBe(3);
  });
});
