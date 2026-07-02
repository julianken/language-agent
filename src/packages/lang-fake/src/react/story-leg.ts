/**
 * The fake leg of the shared portable-stories suite (ADR §4.2): the
 * deterministic MAX-topology fixture states — per-unit split fade within
 * one token, a discontinuous span group, and the YELLOW/RED cases neither
 * real pack produces on demand. `PortableStoryLeg` mirrors the shape
 * declared by the shared suite (structural, like `renderer-types.ts`).
 */

import type { Band, FadeLevel, ScaffoldDirective, UnitRef } from "@la/contract";
import { glyphsOf } from "../annotations.js";
import { fakeRendererEntry } from "./entry.js";
import type { RenderedToken, RendererPackEntry } from "./renderer-types.js";

export interface PortableStoryLeg {
  lang: string;
  entry: RendererPackEntry;
  statuses: string[];
  makeToken(band: Band, level: FadeLevel, status: string): RenderedToken;
  splitFade: {
    tokens: RenderedToken[];
    expectRendered: string[];
    forbidRendered: string[];
  };
  discontinuousSpan: { tokens: RenderedToken[]; spanGroup: string };
  expect: {
    containerDir: "rtl" | "ltr";
    bidiIsolatedTokens: boolean;
    usesRuby: boolean;
  };
}

function fakeDirective(
  lexemeId: string,
  surface: string,
  meaning: FadeLevel,
  glyphHints: Record<string, FadeLevel>,
): ScaffoldDirective {
  const wordUnit: UnitRef = { kind: "word", id: lexemeId };
  return {
    fadeLevels: [
      { dim: "meaning", unit: wordUnit, level: meaning },
      { dim: "stressMark", unit: wordUnit, level: "full" },
      ...[...surface].map((glyph) => ({
        dim: "glyphHint",
        unit: { kind: "glyph", id: glyph } as UnitRef,
        level: glyphHints[glyph] ?? "full",
      })),
    ],
    blend: { anglicize: meaning === "full" },
    dueness: { dueNow: meaning !== "faded" },
  };
}

function fakeToken(
  id: string,
  surface: string,
  band: Band,
  status: string,
  meaning: FadeLevel,
  glyphHints: Record<string, FadeLevel>,
  spanGroup?: string,
): RenderedToken {
  return {
    id,
    text: surface,
    lang: "fake",
    kind: "word",
    status,
    band,
    ...(spanGroup !== undefined ? { spanGroup } : {}),
    annotations: {
      lexemeId: surface,
      gloss: `gloss-of-${surface}`,
      glyphs: glyphsOf(surface),
    },
    directive: fakeDirective(surface, surface, meaning, glyphHints),
  };
}

let seq = 0;

export const fakePortableStoryLeg: PortableStoryLeg = {
  lang: "fake",
  entry: fakeRendererEntry,
  statuses: ["new", "learning", "known"],

  makeToken(band, level, status) {
    return fakeToken(`fake-story-t${seq++}`, "blick", band, status, level, {
      b: level,
      l: level,
      i: level,
      c: level,
      k: level,
    });
  },

  // ONE token, two glyph units at DIFFERENT glyphHint levels (the 銀行
  // case, faked — ADR §1.4): `b`'s hint faded, `l`'s hint full.
  splitFade: {
    tokens: [
      fakeToken("fake-split", "bl", "GREEN", "learning", "partial", {
        b: "faded",
        l: "full",
      }),
    ],
    expectRendered: ['data-glyph-unit="b" data-hint-level="faded"', 'data-glyph-unit="l" data-hint-level="full"'],
    forbidRendered: ['data-glyph-unit="b" data-hint-level="full"'],
  },

  // mip … tok share one span group with an unrelated token between them.
  discontinuousSpan: {
    spanGroup: "sg:miptok:0",
    tokens: [
      fakeToken("fake-span-a", "mip", "GREEN", "new", "full", {}, "sg:miptok:0"),
      fakeToken("fake-span-mid", "zorp", "YELLOW", "learning", "partial", {}),
      fakeToken("fake-span-b", "tok", "GREEN", "new", "full", {}, "sg:miptok:0"),
    ],
  },

  expect: {
    containerDir: "ltr",
    bidiIsolatedTokens: false,
    usesRuby: false,
  },
};
