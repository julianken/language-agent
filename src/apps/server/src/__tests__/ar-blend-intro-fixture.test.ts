/**
 * Guards the `ar-blend-intro` gentle-blend fixture (the `/ar` demo default,
 * mirroring canonical Figma frame `77:2`): mostly-English scaffold with a
 * few Arabic words eased in inline, each new/learning word scaffolded with
 * its romanized reading. A malformed annotation here would crash the
 * `ArWordToken` renderer at stream time (`ArAnnotationsSchema.safeParse`
 * would fail and the token would silently lose its ḥarakāt fade + breakdown
 * panel), so every Arabic word's annotations are validated against the
 * pack's canonical schema — the same schema the renderer decodes with.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ArAnnotationsSchema } from "@la/lang-ar";

const FIXTURE = fileURLToPath(
  new URL("../../fixtures/ar-blend-intro.json", import.meta.url),
);

interface FixtureToken {
  id: string;
  lang: string;
  kind: string;
  status?: string;
  band?: string;
  annotations?: unknown;
}
interface FixtureDoc {
  lang: string;
  blend?: { ratio: number };
  tokens: FixtureToken[];
}

const doc = JSON.parse(readFileSync(FIXTURE, "utf8")) as FixtureDoc;
// Only Arabic words carry `kind:"word"`; the English scaffold is text/punct.
// (Filter by kind, never a `lang ===` branch — the language-blind-core gate.)
const arWords = doc.tokens.filter((t) => t.kind === "word");

describe("ar-blend-intro fixture — gentle blend + valid romanized annotations", () => {
  it("is a LOW-ratio Arabic tutor-message (mostly-English scaffold, frame 77:2)", () => {
    expect(doc.lang).toBe("ar");
    expect(arWords.length).toBeGreaterThanOrEqual(3);
    for (const t of arWords) expect(t.lang).toBe("ar");
    // The gentle blend is English-dominant: only a small share of tokens are
    // the target script (frame 77:2 eases a few Arabic words into English
    // prose) — a deliberate contrast with the Arabic-heavy ar-mixed-line.
    const ratio = arWords.length / doc.tokens.length;
    expect(ratio).toBeLessThanOrEqual(0.34);
  });

  it("every Arabic word's annotations satisfy ArAnnotationsSchema", () => {
    for (const t of arWords) {
      const parsed = ArAnnotationsSchema.safeParse(t.annotations);
      expect(
        parsed.success,
        `${t.id}: ${JSON.stringify(parsed.error?.issues)}`,
      ).toBe(true);
    }
  });

  it("scaffolds new/learning words with a romanization; a known word is bare", () => {
    for (const t of arWords) {
      const ann = ArAnnotationsSchema.parse(t.annotations);
      if (t.status === "new" || t.status === "learning") {
        expect(ann.translit, `${t.id} (${t.status}) should carry a translit`).toBeTruthy();
      }
      if (t.status === "known") {
        expect(ann.translit, `${t.id} (known) renders bare — no translit`).toBeUndefined();
      }
    }
  });

  it("each diac strips to its declared skeleton (fixture-authoring sanity)", () => {
    // ḥarakāt / tanwīn / shadda / sukūn (U+064B–0652) + superscript alef.
    const stripMarks = (s: string) => s.replace(/[ً-ْٰ]/gu, "");
    for (const t of arWords) {
      const ann = ArAnnotationsSchema.parse(t.annotations);
      expect(stripMarks(ann.diac), `${t.id} diac→skeleton`).toBe(ann.skeleton);
    }
  });
});
