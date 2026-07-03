/**
 * Per-CHARACTER ruby unit tests (issue #21 AC, the S1b-harakat-lesson
 * analog folded into the amended issue body): the ruby band renders per
 * character, not per token; the two character units of a word fade
 * INDEPENDENTLY; erhua fusion (structural, synthetic — v0 ships zero real
 * erhua occurrences) folds into the preceding character's slot rather
 * than getting its own `<rt>`.
 */

import { describe, expect, it } from "vitest";
import {
  buildRubySlots,
  renderRubyText,
  renderedScaffoldEcho,
  unitRefsFrom,
  withSegmentalLevels,
  zhCharacterUnitRef,
  zhWordUnitRef,
} from "../ruby.js";
import type { ZhAnnotations } from "../../annotations.js";

const KEYI: ZhAnnotations = {
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
};

// A synthetic erhua-fusion fixture (v0 ships zero real occurrences — see
// annotations.ts's header — but the renderer must not change shape when a
// future sliver adds one): 花兒 huār — the erhua syllable slot fuses into
// the preceding character.
const HUAR_ERHUA: ZhAnnotations = {
  readingId: "花兒:hua1r5",
  perCharacter: [
    { char: "花", citationPinyinChar: "huā", compositionalBoundFlag: false },
    { char: "兒", citationPinyinChar: "ér", compositionalBoundFlag: false },
  ],
  citationPinyin: ["huā", "ér"],
  surfacePinyin: ["huār"],
  toneTrack: [1],
  neutralToneSlots: [],
  erhuaSlots: [1],
  pos: "noun",
  senseId: "flower",
  gloss: "flower",
  boundMorpheme: false,
};

describe("buildRubySlots — per-character, not per-token", () => {
  it("one slot per character for an unfused word", () => {
    const slots = buildRubySlots(KEYI);
    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({ baseChars: "可", surfaceSyllable: "ké", tone: 2, erhuaFused: false });
    expect(slots[1]).toMatchObject({ baseChars: "以", surfaceSyllable: "yǐ", tone: 3, erhuaFused: false });
  });

  it("folds an erhua-fused syllable into the PRECEDING character's slot, never its own <rt>", () => {
    const slots = buildRubySlots(HUAR_ERHUA);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ baseChars: "花兒", surfaceSyllable: "huār", erhuaFused: true });
  });
});

describe("withSegmentalLevels + renderRubyText — the two character units fade INDEPENDENTLY", () => {
  const unit可 = zhCharacterUnitRef("可");
  const unit以 = zhCharacterUnitRef("以");

  it("full/full shows both syllables", () => {
    const directive = {
      fadeLevels: [
        { dim: "segmentalPinyin", unit: unit可, level: "full" as const },
        { dim: "segmentalPinyin", unit: unit以, level: "full" as const },
      ],
      blend: { anglicize: false },
      dueness: { dueNow: true },
    };
    const slots = withSegmentalLevels(buildRubySlots(KEYI), directive);
    expect(slots.map(renderRubyText)).toEqual(["ké", "yǐ"]);
  });

  it("可 faded / 以 full renders ONLY 以's syllable — proof of per-unit independence", () => {
    const directive = {
      fadeLevels: [
        { dim: "segmentalPinyin", unit: unit可, level: "faded" as const },
        { dim: "segmentalPinyin", unit: unit以, level: "full" as const },
      ],
      blend: { anglicize: false },
      dueness: { dueNow: true },
    };
    const slots = withSegmentalLevels(buildRubySlots(KEYI), directive);
    expect(slots.map(renderRubyText)).toEqual([undefined, "yǐ"]);
  });

  it("the mirror case: 可 full / 以 faded renders ONLY 可's syllable", () => {
    const directive = {
      fadeLevels: [
        { dim: "segmentalPinyin", unit: unit可, level: "full" as const },
        { dim: "segmentalPinyin", unit: unit以, level: "faded" as const },
      ],
      blend: { anglicize: false },
      dueness: { dueNow: true },
    };
    const slots = withSegmentalLevels(buildRubySlots(KEYI), directive);
    expect(slots.map(renderRubyText)).toEqual(["ké", undefined]);
  });

  it("a unit with no directive entry defaults to full (fail-safe)", () => {
    const slots = withSegmentalLevels(buildRubySlots(KEYI), undefined);
    expect(slots.map((s) => s.segmentalLevel)).toEqual(["full", "full"]);
  });
});

describe("directive plumbing", () => {
  it("derives the pack-canonical word/character UnitRefs", () => {
    expect(zhWordUnitRef("可以:ke3yi3")).toEqual({ kind: "word", id: "可以:ke3yi3" });
    expect(zhCharacterUnitRef("可")).toEqual({ kind: "character", id: "可" });
  });

  it("echoes what the learner actually saw, per dimension", () => {
    const directive = {
      fadeLevels: [
        { dim: "meaning", unit: zhWordUnitRef("可以:ke3yi3"), level: "faded" as const },
        { dim: "segmentalPinyin", unit: zhCharacterUnitRef("可"), level: "full" as const },
      ],
      blend: { anglicize: false },
      dueness: { dueNow: true },
    };
    expect(renderedScaffoldEcho(directive)).toEqual({ meaning: "hidden", segmentalPinyin: "shown" });
  });

  it("collects every unit the directive names, deduplicated", () => {
    const directive = {
      fadeLevels: [
        { dim: "segmentalPinyin", unit: zhCharacterUnitRef("可"), level: "full" as const },
        { dim: "tone", unit: zhCharacterUnitRef("可"), level: "full" as const },
        { dim: "segmentalPinyin", unit: zhCharacterUnitRef("以"), level: "full" as const },
      ],
      blend: { anglicize: false },
      dueness: { dueNow: true },
    };
    expect(unitRefsFrom(directive)).toEqual([zhCharacterUnitRef("可"), zhCharacterUnitRef("以")]);
  });
});
