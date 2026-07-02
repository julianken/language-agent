/**
 * AC coverage (issue #7, spec-first opening PR): "`ar-annotations.schema.json`
 * is generated from the pack's canonical zod schema and freshness-gated" —
 * the in-test half of the freshness gate (CI's `git diff --exit-code` is
 * the other), plus schema-half sanity: strictness, the vowelState enum,
 * and JSON round-trip survival (the schema is the wire/storage validation
 * boundary; encode/decode themselves are #9's, deliberately absent here).
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AR_ANNOTATIONS_SCHEMA_ID,
  ArAnnotationsSchema,
} from "../annotations.js";

const validAnnotation = {
  diac: "كَتَبَ",
  skeleton: "كتب",
  vowelState: "full",
  morphology: {
    lemma: "كَتَبَ",
    root: "ك.ت.ب",
    pattern: "1a2a3",
    pos: "verb",
    gloss: "to write",
  },
} as const;

describe("ArAnnotationsSchema (seam 3, schema half)", () => {
  it("accepts a canonical annotation payload", () => {
    expect(() => ArAnnotationsSchema.parse(validAnnotation)).not.toThrow();
  });

  it("survives a JSON round-trip (wire/storage boundary)", () => {
    const parsed = ArAnnotationsSchema.parse(
      JSON.parse(JSON.stringify(validAnnotation)),
    );
    expect(parsed).toEqual(validAnnotation);
  });

  it("is strict: unknown keys are a violation, not silent drift", () => {
    expect(
      ArAnnotationsSchema.safeParse({ ...validAnnotation, toneTrack: [1] })
        .success,
    ).toBe(false);
    expect(
      ArAnnotationsSchema.safeParse({
        ...validAnnotation,
        morphology: { ...validAnnotation.morphology, extra: "x" },
      }).success,
    ).toBe(false);
  });

  it("rejects a vowelState outside full|partial|none and empty core fields", () => {
    expect(
      ArAnnotationsSchema.safeParse({ ...validAnnotation, vowelState: "half" })
        .success,
    ).toBe(false);
    expect(
      ArAnnotationsSchema.safeParse({ ...validAnnotation, skeleton: "" })
        .success,
    ).toBe(false);
  });

  it("declares the versioned schema id the annotations envelope carries", () => {
    expect(AR_ANNOTATIONS_SCHEMA_ID).toBe("ar-annotations/v1");
  });

  it("matches the committed generated artifact (freshness, in-test half)", () => {
    const artifactUrl = new URL(
      "../../ar-annotations.schema.json",
      import.meta.url,
    );
    const committed = JSON.parse(readFileSync(artifactUrl, "utf8")) as unknown;
    const regenerated = {
      $id: AR_ANNOTATIONS_SCHEMA_ID,
      ...z.toJSONSchema(ArAnnotationsSchema, { target: "draft-2020-12" }),
    };
    expect(committed).toEqual(regenerated);
  });
});
