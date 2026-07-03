/**
 * Unit tests for `enrichZhAnnotations` — the pure wire-payload-enrichment
 * function `gate.ts` uses to turn the real sidecar's thin per-token
 * payload into this pack's canonical `ZhAnnotations` shape. The TCK's
 * golden-fixture harness (`conformance.test.ts`) exercises this same
 * function end-to-end against the REAL booted sidecar; these tests pin
 * its behavior at the unit level, independent of a running sidecar.
 */

import { describe, expect, it } from "vitest";
import { enrichZhAnnotations } from "../gate.js";

describe("enrichZhAnnotations", () => {
  it("enriches a word-kind wire payload into perCharacter[]/toneTrack/neutralToneSlots", () => {
    const result = enrichZhAnnotations(
      { surface: "可以", band: "GREEN" },
      {
        readingId: "可以:ke3yi3",
        citationPinyin: ["kě", "yǐ"],
        surfacePinyin: ["ké", "yǐ"],
        pos: "verb",
        senseId: "can",
        gloss: "can; may",
      },
    );
    expect(result).toEqual({
      readingId: "可以:ke3yi3",
      perCharacter: [
        { char: "可", citationPinyinChar: "kě", compositionalBoundFlag: false },
        { char: "以", citationPinyinChar: "yǐ", compositionalBoundFlag: false },
      ],
      citationPinyin: ["kě", "yǐ"],
      surfacePinyin: ["ké", "yǐ"],
      toneTrack: [2, 3],
      neutralToneSlots: [],
      erhuaSlots: [],
      pos: "verb",
      senseId: "can",
      gloss: "can; may",
      boundMorpheme: false,
    });
  });

  it("derives neutralToneSlots from tone-5 (undiacritized) syllables", () => {
    const result = enrichZhAnnotations(
      { surface: "的", band: "GREEN" },
      { citationPinyin: ["de"], surfacePinyin: ["de"], contextKey: "我|的|茶" },
    );
    expect(result.toneTrack).toEqual([5]);
    expect(result.neutralToneSlots).toEqual([0]);
    expect(result.contextKey).toBe("我|的|茶");
  });

  it("maps a single-kind wire payload's rule field through", () => {
    const result = enrichZhAnnotations(
      { surface: "一", band: "GREEN" },
      { citationPinyin: ["yī"], surfacePinyin: ["yí"], contextKey: "<START>|一|個", rule: "tone-shift-before-4" },
    );
    expect(result.rule).toBe("tone-shift-before-4");
    expect(result.toneTrack).toEqual([2]);
  });

  it("maps a non-linguistic (punct/digit) empty wire payload to the degenerate empty shape", () => {
    const result = enrichZhAnnotations({ surface: "？", band: "GREEN" }, {});
    expect(result).toEqual({
      perCharacter: [],
      citationPinyin: [],
      surfacePinyin: [],
      toneTrack: [],
      neutralToneSlots: [],
      erhuaSlots: [],
      boundMorpheme: false,
    });
  });

  it("maps a token-level RED wire payload's reason into redReason, with empty linguistic fields", () => {
    const result = enrichZhAnnotations(
      { surface: "你喝咖啡嗎", band: "RED" },
      { reason: "out-of-world" },
    );
    expect(result).toEqual({
      perCharacter: [],
      citationPinyin: [],
      surfacePinyin: [],
      toneTrack: [],
      neutralToneSlots: [],
      erhuaSlots: [],
      boundMorpheme: false,
      redReason: "out-of-world",
    });
  });

  it("maps a candidate-level regenerate collapse's action+reason into one redReason string", () => {
    const result = enrichZhAnnotations(
      { surface: "不好了", band: "RED" },
      { action: "regenerate-candidate", reason: "crossword-third-tone-run", legId: "sandhi-resolver" },
    );
    expect(result.redReason).toBe("regenerate-candidate:crossword-third-tone-run");
  });
});
