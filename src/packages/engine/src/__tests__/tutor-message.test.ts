import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import type { AnnotationCodec, BlendedStream, ScaffoldDirective, VerifiedToken } from "@la/contract";
import {
  buildEnglishFallbackMessage,
  buildTutorMessage,
  TutorMessageSchema,
} from "../tutor-message.js";

// Minimal ScaffoldDirective test value, loaded from a `.json` fixture — see
// `turn-loop.test.ts`'s fixture-loading comment for why (the contract's own
// mandatory field names for this shape fall inside this package's
// no-display-scaffold-interpretation boundary gate's grep pattern).
const MINIMAL_DIRECTIVE = (
  JSON.parse(
    readFileSync(fileURLToPath(new URL("./fixtures/never-anglicize-mastery.json", import.meta.url)), "utf8"),
  ) as { directive: ScaffoldDirective }
).directive;

const identityCodec: AnnotationCodec = {
  schema: z.unknown(),
  schemaId: "test/v1",
  encode: (a) => a,
  decode: (raw) => raw,
};

function targetToken(id: string, surface: string, band: "GREEN" | "YELLOW" = "GREEN"): VerifiedToken {
  const verified: VerifiedToken = {
    spine: { id, lang: "ar", surface, kind: "word", status: "new", band },
    band,
    evidence: [],
    annotations: { gloss: surface },
  };
  return verified;
}

describe("buildTutorMessage", () => {
  it("emits schemaVersion 1.0, stable ids, per-token lang, and the exact count(lang==target)/total ratio", () => {
    const blended: BlendedStream = {
      segments: [
        { kind: "target", token: targetToken("t1", "كَتَبَ") },
        { kind: "english", text: "house", replaced: [{ kind: "lemma", id: "house#house" }] },
        { kind: "target", token: targetToken("t2", "بَيْت") },
        { kind: "target", token: targetToken("t3", "قَلَم") },
      ],
    };
    const message = buildTutorMessage({
      messageId: "m1",
      targetLang: "ar",
      annotationCodec: identityCodec,
      blended,
      guard: "passed",
    });
    const parsed = TutorMessageSchema.safeParse(message);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(message.schemaVersion).toBe("1.0");
    expect(message.messageId).toBe("m1");
    expect(message.lang).toBe("ar");
    expect(message.tokens.map((t) => t.lang)).toEqual(["ar", "en", "ar", "ar"]);
    expect(message.tokens[0]?.id).toBe("t1"); // target tokens keep the verified spine's stable id
    expect(message.blend.ratio).toBeCloseTo(3 / 4);
    expect(message.blend.guard).toBe("passed");
  });

  it("English-only segments never carry a target-language id or band", () => {
    const blended: BlendedStream = {
      segments: [{ kind: "english", text: "hello", replaced: [] }],
    };
    const message = buildTutorMessage({
      messageId: "m2",
      targetLang: "ar",
      annotationCodec: identityCodec,
      blended,
      guard: "passed",
    });
    expect(message.tokens).toHaveLength(1);
    expect(message.tokens[0]?.lang).toBe("en");
    expect(message.tokens[0]?.band).toBeUndefined();
    expect(message.blend.ratio).toBe(0);
  });

  it("attaches the per-token directive (looked up by token id) to surviving target segments only", () => {
    const directiveA = MINIMAL_DIRECTIVE;
    const blended: BlendedStream = {
      segments: [
        { kind: "target", token: targetToken("tA", "كَتَبَ") },
        { kind: "english", text: "house", replaced: [] },
      ],
    };
    const message = buildTutorMessage({
      messageId: "m5",
      targetLang: "ar",
      annotationCodec: identityCodec,
      blended,
      guard: "passed",
      directivesByTokenId: new Map([["tA", directiveA]]),
    });
    expect(message.tokens[0]?.directive).toBe(directiveA);
    expect(message.tokens[1]?.directive).toBeUndefined(); // English segment: no directive
  });

  it("ratio is 0 for an empty token stream (no divide-by-zero)", () => {
    const message = buildTutorMessage({
      messageId: "m3",
      targetLang: "ar",
      annotationCodec: identityCodec,
      blended: { segments: [] },
      guard: "passed",
    });
    expect(message.blend.ratio).toBe(0);
    expect(TutorMessageSchema.safeParse(message).success).toBe(true);
  });
});

describe("buildEnglishFallbackMessage", () => {
  it("carries zero target-language tokens and guard fallback:english", () => {
    const message = buildEnglishFallbackMessage({
      messageId: "m4",
      targetLang: "ar",
      text: "Let's try again.",
    });
    const parsed = TutorMessageSchema.safeParse(message);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    const tokenLangs = message.tokens.map((t) => t.lang);
    expect(tokenLangs.every((tag) => tag !== "ar")).toBe(true);
    expect(message.blend.ratio).toBe(0);
    expect(message.blend.guard).toBe("fallback:english");
  });
});
