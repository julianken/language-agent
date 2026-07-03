import { describe, expect, it } from "vitest";
import type { ScaffoldDirective, VerifiedToken } from "@la/contract";
import type { ArAnnotations } from "../annotations.js";
import { makeArSteering } from "../steering.js";
import { arLemmaUnitRef } from "../react/harakat.js";

function ctx() {
  return {
    sidecar: { baseUrl: "http://127.0.0.1:0" },
    assets: { read: () => Promise.reject(new Error("not used")) },
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    config: {},
    fsrs: {},
  };
}

const KABIRA: ArAnnotations = {
  diac: "كَبِيرَةٌ",
  skeleton: "كبيرة",
  vowelState: "full",
  morphology: { lemma: "كَبِير", root: "ك ب ر", pattern: "فَعِيل", pos: "ADJ", gloss: "big" },
};

function wordToken(id: string, ann: ArAnnotations): VerifiedToken<ArAnnotations> {
  return {
    spine: { id, lang: "ar", surface: ann.diac, kind: "word", status: "new", band: "GREEN" },
    band: "GREEN",
    evidence: [],
    annotations: ann,
  };
}

function punctToken(id: string, surface: string): VerifiedToken<ArAnnotations> {
  return {
    spine: { id, lang: "ar", surface, kind: "punct", status: "new", band: "GREEN" },
    band: "GREEN",
    evidence: [],
    annotations: { diac: surface, skeleton: surface, vowelState: "none", morphology: { lemma: surface, root: surface, pattern: surface, pos: "punc", gloss: surface } },
  };
}

const directive = (anglicize: boolean): ScaffoldDirective => ({
  fadeLevels: [],
  blend: { anglicize },
  dueness: { dueNow: true },
});

describe("makeArSteering.generationConstraints", () => {
  it("pins high/formal MSA + full vocalization and echoes every intent", () => {
    const steering = makeArSteering(ctx());
    const constraints = steering.generationConstraints({
      intents: [{ id: "i1", description: "talk about the library" }],
    });
    expect(constraints.instructions.some((s) => /MSA/.test(s))).toBe(true);
    expect(constraints.instructions.some((s) => /vocalize/i.test(s))).toBe(true);
    expect(constraints.instructions).toContain("Express: talk about the library");
  });
});

describe("makeArSteering.anglicizeDown", () => {
  it("anglicizes a word token when directed, carrying the intended gloss + the arLemmaUnitRef unit", () => {
    const steering = makeArSteering(ctx());
    const stream = [wordToken("t1", KABIRA)];
    const out = steering.anglicizeDown(stream, [directive(true)]);
    expect(out.segments).toEqual([
      { kind: "english", text: "big", replaced: [arLemmaUnitRef(KABIRA.morphology)] },
    ]);
  });

  it("keeps a word token in Arabic when not directed to anglicize", () => {
    const steering = makeArSteering(ctx());
    const stream = [wordToken("t1", KABIRA)];
    const out = steering.anglicizeDown(stream, [directive(false)]);
    expect(out.segments).toEqual([{ kind: "target", token: stream[0] }]);
  });

  it("NEVER anglicizes a non-word (punctuation) token, even when directed to", () => {
    const steering = makeArSteering(ctx());
    const stream = [punctToken("t1", ".")];
    const out = steering.anglicizeDown(stream, [directive(true)]);
    expect(out.segments).toEqual([{ kind: "target", token: stream[0] }]);
  });

  it("subtraction-safety: never mints a target byte that wasn't in the input", () => {
    const steering = makeArSteering(ctx());
    const stream = [wordToken("t1", KABIRA), punctToken("t2", ".")];
    const out = steering.anglicizeDown(stream, [directive(true), directive(true)]);
    const targetIds = out.segments.flatMap((s) => (s.kind === "target" ? [s.token.spine.id] : []));
    const inputIds = stream.map((t) => t.spine.id);
    for (const id of targetIds) expect(inputIds).toContain(id);
  });

  it("frame preservation: segment order mirrors token order", () => {
    const steering = makeArSteering(ctx());
    const stream = [wordToken("t1", KABIRA), punctToken("t2", "."), wordToken("t3", KABIRA)];
    const out = steering.anglicizeDown(stream, [directive(false), directive(false), directive(false)]);
    expect(out.segments.map((s) => (s.kind === "target" ? s.token.spine.id : undefined))).toEqual([
      "t1",
      "t2",
      "t3",
    ]);
  });
});
