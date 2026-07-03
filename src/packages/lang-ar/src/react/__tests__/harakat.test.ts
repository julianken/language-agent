/**
 * The two vowel dimensions are INDEPENDENT per-unit directives (issue #10
 * AC: "a test fixture with one dimension faded and the other full renders
 * the two ḥarakāt classes differently") — plus the classification
 * heuristic's edge cases (final-base marks, the ًا adverbial tanwīn,
 * shadda never stripped).
 */

import { describe, expect, it } from "vitest";
import {
  arLemmaUnitRef,
  classifyMarks,
  renderVowels,
  renderedScaffoldEcho,
  vowelLevelsFrom,
} from "../harakat.js";

const MAKTABATUN = "مَكْتَبَةٌ"; // fatḥa/sukūn/fatḥa/fatḥa + final ḍammatān
const KABIRATUN = "كَبِيرَةٌ";
const MARHABAN = "مَرْحَبًا"; // fatḥatān on penultimate base before final alef
const SHADDA_WORD = "رَدَّ"; // shadda must survive every level

describe("classifyMarks", () => {
  it("classes final-base marks as caseEnding, the rest lexical", () => {
    const classes = classifyMarks(MAKTABATUN).map((m) => m.cls);
    expect(classes).toEqual(["lexical", "lexical", "lexical", "lexical", "caseEnding"]);
  });

  it("classes fatḥatān before a final alef as caseEnding (مَرْحَبًا)", () => {
    const marks = classifyMarks(MARHABAN);
    expect(marks[marks.length - 1]?.cls).toBe("caseEnding");
    expect(marks.slice(0, -1).every((m) => m.cls === "lexical")).toBe(true);
  });
});

describe("renderVowels — the two dimensions fade independently", () => {
  it("lexical faded × caseEnding full keeps ONLY the tanwīn", () => {
    expect(renderVowels(KABIRATUN, { lexical: "faded", caseEnding: "full" })).toBe(
      "كبيرةٌ",
    );
  });

  it("lexical full × caseEnding faded keeps ONLY the body vowels", () => {
    expect(renderVowels(KABIRATUN, { lexical: "full", caseEnding: "faded" })).toBe(
      "كَبِيرَة",
    );
  });

  it("the two mixed renderings differ from each other and from full/bare", () => {
    const lexFaded = renderVowels(KABIRATUN, { lexical: "faded", caseEnding: "full" });
    const caseFaded = renderVowels(KABIRATUN, { lexical: "full", caseEnding: "faded" });
    expect(lexFaded).not.toBe(caseFaded);
    expect(lexFaded).not.toBe(KABIRATUN);
    expect(caseFaded).not.toBe(KABIRATUN);
    expect(renderVowels(KABIRATUN, { lexical: "full", caseEnding: "full" })).toBe(
      KABIRATUN,
    );
    expect(renderVowels(KABIRATUN, { lexical: "faded", caseEnding: "faded" })).toBe(
      "كبيرة",
    );
  });

  it("partial lexical keeps only the first lexical mark", () => {
    expect(renderVowels(MAKTABATUN, { lexical: "partial", caseEnding: "faded" })).toBe(
      "مَكتبة",
    );
  });

  it("never strips shadda (consonant skeleton, not a vowel scaffold)", () => {
    const bare = renderVowels(SHADDA_WORD, { lexical: "faded", caseEnding: "faded" });
    expect(bare).toContain("ّ"); // shadda survives
    expect(bare).not.toContain("َ"); // fatḥa stripped
  });

  it("strips the adverbial fatḥatān as a case ending (مَرْحَبًا)", () => {
    const noCase = renderVowels(MARHABAN, { lexical: "full", caseEnding: "faded" });
    expect(noCase).not.toContain("ً");
    expect(noCase).toContain("َ");
  });
});

describe("directive plumbing", () => {
  const unit = { kind: "lemma", id: "كَبِير#big" };
  const directive = {
    fadeLevels: [
      { dim: "vowelFadeLexical", unit, level: "faded" as const },
      { dim: "vowelFadeCaseEnding", unit, level: "full" as const },
    ],
    blend: { anglicize: false },
    dueness: { dueNow: true },
  };

  it("reads the two dimensions as independent per-unit levels", () => {
    expect(vowelLevelsFrom(directive)).toEqual({ lexical: "faded", caseEnding: "full" });
    expect(vowelLevelsFrom(undefined)).toEqual({ lexical: "full", caseEnding: "full" });
  });

  it("scopes the read to the token's OWN unit — a directive entry for a DIFFERENT unit id has no effect", () => {
    const otherUnit = { kind: "lemma", id: "مَكْتَبَة#library" };
    // Per-(dimension × unit) directive (the #9 shape): entries for BOTH
    // units ride the same token envelope, at opposite levels.
    const multiUnit = {
      fadeLevels: [
        { dim: "vowelFadeLexical", unit: otherUnit, level: "faded" as const },
        { dim: "vowelFadeCaseEnding", unit: otherUnit, level: "faded" as const },
        { dim: "vowelFadeLexical", unit, level: "full" as const },
        { dim: "vowelFadeCaseEnding", unit, level: "partial" as const },
      ],
      blend: { anglicize: false },
      dueness: { dueNow: true },
    };
    // Scoped to OUR unit: the foreign unit's `faded` entries (listed
    // FIRST, so a dimension-only find() would wrongly pick them) never
    // bleed through.
    expect(vowelLevelsFrom(multiUnit, unit)).toEqual({
      lexical: "full",
      caseEnding: "partial",
    });
    // And scoped to the other unit, its own levels come back.
    expect(vowelLevelsFrom(multiUnit, otherUnit)).toEqual({
      lexical: "faded",
      caseEnding: "faded",
    });
    // A unit with NO entries at all falls back to full/full (fail-safe).
    expect(
      vowelLevelsFrom(multiUnit, { kind: "lemma", id: "غَيْر#absent" }),
    ).toEqual({ lexical: "full", caseEnding: "full" });
  });

  it("derives the pack-canonical lemma unit from annotations (lemma#gloss)", () => {
    expect(arLemmaUnitRef({ lemma: "كَبِير", gloss: "big" })).toEqual(unit);
  });

  it("echoes what the learner actually saw, per dimension", () => {
    expect(renderedScaffoldEcho(directive)).toEqual({
      vowelFadeLexical: "hidden",
      vowelFadeCaseEnding: "shown",
    });
  });
});
