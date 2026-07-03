import { describe, expect, it } from "vitest";
import { arAnnotationCodec } from "../codec.js";
import { AR_ANNOTATIONS_SCHEMA_ID } from "../annotations.js";

const SAMPLE = {
  diac: "كَتَبَ",
  skeleton: "كتب",
  vowelState: "full" as const,
  morphology: {
    lemma: "كَتَب",
    root: "ك.ت.ب",
    pattern: "1َ2َ3َ",
    pos: "verb",
    gloss: "write",
  },
};

describe("arAnnotationCodec", () => {
  it("schemaId matches the canonical AR_ANNOTATIONS_SCHEMA_ID", () => {
    expect(arAnnotationCodec.schemaId).toBe(AR_ANNOTATIONS_SCHEMA_ID);
  });

  it("decode(encode(a)) deep-equals a (TCK round-trip law)", () => {
    const encoded = arAnnotationCodec.encode(SAMPLE);
    const decoded = arAnnotationCodec.decode(encoded);
    expect(decoded).toEqual(SAMPLE);
  });

  it("encode() is JSON-shaped (round-trips through JSON.stringify/parse unchanged)", () => {
    const encoded = arAnnotationCodec.encode(SAMPLE);
    expect(JSON.parse(JSON.stringify(encoded))).toEqual(encoded);
  });

  it("decode() rejects a payload missing a required field", () => {
    expect(() => arAnnotationCodec.decode({ ...SAMPLE, diac: undefined })).toThrow();
  });
});
