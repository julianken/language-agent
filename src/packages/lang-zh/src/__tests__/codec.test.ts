import { describe, expect, it } from "vitest";
import { zhAnnotationCodec } from "../codec.js";
import { ZH_ANNOTATIONS_SCHEMA_ID } from "../annotations.js";

const SAMPLE = {
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

describe("zhAnnotationCodec", () => {
  it("schemaId matches the canonical ZH_ANNOTATIONS_SCHEMA_ID", () => {
    expect(zhAnnotationCodec.schemaId).toBe(ZH_ANNOTATIONS_SCHEMA_ID);
  });

  it("decode(encode(a)) deep-equals a (TCK round-trip law)", () => {
    const encoded = zhAnnotationCodec.encode(SAMPLE);
    const decoded = zhAnnotationCodec.decode(encoded);
    expect(decoded).toEqual(SAMPLE);
  });

  it("encode() is JSON-shaped (round-trips through JSON.stringify/parse unchanged)", () => {
    const encoded = zhAnnotationCodec.encode(SAMPLE);
    expect(JSON.parse(JSON.stringify(encoded))).toEqual(encoded);
  });

  it("decode() rejects a payload missing a required field", () => {
    expect(() => zhAnnotationCodec.decode({ ...SAMPLE, perCharacter: undefined })).toThrow();
  });
});
