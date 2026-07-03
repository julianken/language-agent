import { describe, expect, it } from "vitest";
import type { ScaffoldDirective, VerifiedToken } from "@la/contract";
import type { ZhAnnotations } from "../annotations.js";
import { makeZhSteering } from "../steering.js";
import { zhWordUnitRef } from "../react/ruby.js";

function ctx() {
  return {
    sidecar: { baseUrl: "http://127.0.0.1:0" },
    assets: { read: () => Promise.reject(new Error("not used")) },
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    config: {},
    fsrs: {},
  };
}

const HAO: ZhAnnotations = {
  readingId: "好:hao3",
  perCharacter: [{ char: "好", citationPinyinChar: "hǎo", compositionalBoundFlag: false }],
  citationPinyin: ["hǎo"],
  surfacePinyin: ["hǎo"],
  toneTrack: [3],
  neutralToneSlots: [],
  erhuaSlots: [],
  pos: "adjective",
  senseId: "good",
  gloss: "good",
  boundMorpheme: false,
};

const GE_CLASSIFIER: ZhAnnotations = {
  readingId: "個:ge4",
  perCharacter: [{ char: "個", citationPinyinChar: "gè", compositionalBoundFlag: false }],
  citationPinyin: ["gè"],
  surfacePinyin: ["gè"],
  toneTrack: [4],
  neutralToneSlots: [],
  erhuaSlots: [],
  pos: "classifier",
  senseId: "clf-general",
  gloss: "general classifier",
  boundMorpheme: false,
};

function wordToken(id: string, ann: ZhAnnotations, kind = "word"): VerifiedToken<ZhAnnotations> {
  return {
    spine: { id, lang: "zh", surface: ann.perCharacter.map((c) => c.char).join(""), kind, status: "new", band: "GREEN" },
    band: "GREEN",
    evidence: [],
    annotations: ann,
  };
}

function punctToken(id: string, surface: string): VerifiedToken<ZhAnnotations> {
  return {
    spine: { id, lang: "zh", surface, kind: "punct", status: "new", band: "GREEN" },
    band: "GREEN",
    evidence: [],
    annotations: {
      perCharacter: [],
      citationPinyin: [],
      surfacePinyin: [],
      toneTrack: [],
      neutralToneSlots: [],
      erhuaSlots: [],
      boundMorpheme: false,
    },
  };
}

const directive = (anglicize: boolean): ScaffoldDirective => ({
  fadeLevels: [],
  blend: { anglicize },
  dueness: { dueNow: true },
});

describe("makeZhSteering.generationConstraints", () => {
  it("pins Traditional script + Putonghua reading + Matrix-Language-Frame discipline, and echoes every intent", () => {
    const steering = makeZhSteering(ctx());
    const constraints = steering.generationConstraints({
      intents: [{ id: "good", description: "talk about how good it is" }],
    });
    expect(constraints.instructions.some((s) => /Traditional/.test(s))).toBe(true);
    expect(constraints.instructions.some((s) => /Putonghua/.test(s))).toBe(true);
    expect(constraints.instructions.some((s) => /Matrix Language/.test(s))).toBe(true);
    expect(constraints.instructions).toContain("Express: talk about how good it is");
  });
});

describe("makeZhSteering.anglicizeDown", () => {
  it("anglicizes a word token when directed, carrying the intended gloss + the zhWordUnitRef unit", () => {
    const steering = makeZhSteering(ctx());
    const stream = [wordToken("t1", HAO)];
    const out = steering.anglicizeDown(stream, [directive(true)]);
    expect(out.segments).toEqual([{ kind: "english", text: "good", replaced: [zhWordUnitRef("好:hao3")] }]);
  });

  it("keeps a word token in Chinese when not directed to anglicize", () => {
    const steering = makeZhSteering(ctx());
    const stream = [wordToken("t1", HAO)];
    const out = steering.anglicizeDown(stream, [directive(false)]);
    expect(out.segments).toEqual([{ kind: "target", token: stream[0] }]);
  });

  it("NEVER anglicizes a non-word (punctuation) token, even when directed to", () => {
    const steering = makeZhSteering(ctx());
    const stream = [punctToken("t1", "。")];
    const out = steering.anglicizeDown(stream, [directive(true)]);
    expect(out.segments).toEqual([{ kind: "target", token: stream[0] }]);
  });

  it("NEVER anglicizes a classifier word-kind token, even when directed to (design §4.3's numeral/classifier allowlist)", () => {
    const steering = makeZhSteering(ctx());
    const stream = [wordToken("t1", GE_CLASSIFIER)];
    const out = steering.anglicizeDown(stream, [directive(true)]);
    expect(out.segments).toEqual([{ kind: "target", token: stream[0] }]);
  });

  it("subtraction-safety: never mints a target byte that wasn't in the input", () => {
    const steering = makeZhSteering(ctx());
    const stream = [wordToken("t1", HAO), punctToken("t2", "。")];
    const out = steering.anglicizeDown(stream, [directive(true), directive(true)]);
    const targetIds = out.segments.flatMap((s) => (s.kind === "target" ? [s.token.spine.id] : []));
    const inputIds = stream.map((t) => t.spine.id);
    for (const id of targetIds) expect(inputIds).toContain(id);
  });

  it("frame preservation: segment order mirrors token order", () => {
    const steering = makeZhSteering(ctx());
    const stream = [wordToken("t1", HAO), punctToken("t2", "。"), wordToken("t3", HAO)];
    const out = steering.anglicizeDown(stream, [directive(false), directive(false), directive(false)]);
    expect(out.segments.map((s) => (s.kind === "target" ? s.token.spine.id : undefined))).toEqual([
      "t1",
      "t2",
      "t3",
    ]);
  });
});
