/**
 * AC coverage (issue #21): "`zh-annotations.schema.json` is generated from
 * the pack's canonical zod schema and freshness-gated" — the in-test half
 * of the freshness gate (CI's `git diff --exit-code` is the other), plus
 * schema-half sanity: strictness, the per-character/tone-track shapes, and
 * JSON round-trip survival.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ZH_ANNOTATIONS_SCHEMA_ID,
  ZhAnnotationsSchema,
} from "../annotations.js";

const validAnnotation = {
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
} as const;

describe("ZhAnnotationsSchema (seam 3, schema half)", () => {
  it("accepts a canonical annotation payload", () => {
    expect(() => ZhAnnotationsSchema.parse(validAnnotation)).not.toThrow();
  });

  it("accepts the degenerate empty shape (punct/digit tokens carry no linguistic content)", () => {
    expect(() =>
      ZhAnnotationsSchema.parse({
        perCharacter: [],
        citationPinyin: [],
        surfacePinyin: [],
        toneTrack: [],
        neutralToneSlots: [],
        erhuaSlots: [],
        boundMorpheme: false,
      }),
    ).not.toThrow();
  });

  it("accepts a RED token's degenerate shape with only redReason set", () => {
    expect(() =>
      ZhAnnotationsSchema.parse({
        perCharacter: [],
        citationPinyin: [],
        surfacePinyin: [],
        toneTrack: [],
        neutralToneSlots: [],
        erhuaSlots: [],
        boundMorpheme: false,
        redReason: "out-of-world",
      }),
    ).not.toThrow();
  });

  it("survives a JSON round-trip (wire/storage boundary)", () => {
    const parsed = ZhAnnotationsSchema.parse(
      JSON.parse(JSON.stringify(validAnnotation)),
    );
    expect(parsed).toEqual(validAnnotation);
  });

  it("is strict: unknown keys are a violation, not silent drift", () => {
    expect(
      ZhAnnotationsSchema.safeParse({ ...validAnnotation, wrongField: 1 }).success,
    ).toBe(false);
    expect(
      ZhAnnotationsSchema.safeParse({
        ...validAnnotation,
        perCharacter: [{ ...validAnnotation.perCharacter[0], extra: "x" }],
      }).success,
    ).toBe(false);
  });

  it("rejects a tone digit outside 1-5 and empty core fields", () => {
    expect(
      ZhAnnotationsSchema.safeParse({ ...validAnnotation, toneTrack: [0, 3] }).success,
    ).toBe(false);
    expect(
      ZhAnnotationsSchema.safeParse({ ...validAnnotation, toneTrack: [6, 3] }).success,
    ).toBe(false);
    expect(
      ZhAnnotationsSchema.safeParse({
        ...validAnnotation,
        perCharacter: [{ char: "", citationPinyinChar: "kě", compositionalBoundFlag: false }],
      }).success,
    ).toBe(false);
  });

  it("declares the versioned schema id the annotations envelope carries", () => {
    expect(ZH_ANNOTATIONS_SCHEMA_ID).toBe("zh-annotations/v1");
  });

  it("matches the committed generated artifact (freshness, in-test half)", () => {
    const artifactUrl = new URL(
      "../../zh-annotations.schema.json",
      import.meta.url,
    );
    const committed = JSON.parse(readFileSync(artifactUrl, "utf8")) as unknown;
    const regenerated = {
      $id: ZH_ANNOTATIONS_SCHEMA_ID,
      ...z.toJSONSchema(ZhAnnotationsSchema, { target: "draft-2020-12" }),
    };
    expect(committed).toEqual(regenerated);
  });
});
