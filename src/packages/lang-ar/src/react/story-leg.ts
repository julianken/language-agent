/**
 * The `ar` leg of the shared portable-stories suite (ADR §4.2 seam-6 test
 * category): this pack's fixture tokens for the generic story states —
 * each band × fade stage × learner status, plus the per-unit split-fade
 * story and the discontinuous-span story. The SHARED story file lives with
 * the shell (`src/apps/web/src/stories/`) and is written against the
 * contract; each language instantiates it with a leg like this one.
 */

import type { Band, FadeLevel, ScaffoldDirective, UnitRef } from "@la/contract";
import { arRendererEntry } from "./entry.js";
import type { RenderedToken, RendererPackEntry } from "./renderer-types.js";

export interface PortableStoryLeg {
  lang: string;
  entry: RendererPackEntry;
  /** Pack-interpreted learner-status vocabulary for the story matrix. */
  statuses: string[];
  /** One token for a (band × fade level × status) matrix cell. */
  makeToken(band: Band, level: FadeLevel, status: string): RenderedToken;
  /** Per-unit split-fade state: one token, two fade slots at DIFFERENT
   * levels; `expectRendered`/`forbidRendered` are exact substrings of the
   * rendered markup. */
  splitFade: {
    tokens: RenderedToken[];
    expectRendered: string[];
    forbidRendered: string[];
  };
  /** Two NON-adjacent tokens sharing one span group (ADR §1.3 port 1). */
  discontinuousSpan: { tokens: RenderedToken[]; spanGroup: string };
  expect: {
    containerDir: "rtl" | "ltr";
    /** Every token wrapped in <bdi dir="auto"> (the spike recipe). */
    bidiIsolatedTokens: boolean;
    /** Ruby annotations are zh-only (ADR §4.2). */
    usesRuby: boolean;
  };
}

const LEMMA_UNIT: UnitRef = { kind: "lemma", id: "مَكْتَبَة#library" };
const KABIRA_UNIT: UnitRef = { kind: "lemma", id: "كَبِير#big" };

function vowelDirective(
  unit: UnitRef,
  lexical: FadeLevel,
  caseEnding: FadeLevel,
): ScaffoldDirective {
  return {
    fadeLevels: [
      { dim: "vowelFadeLexical", unit, level: lexical },
      { dim: "vowelFadeCaseEnding", unit, level: caseEnding },
    ],
    blend: { anglicize: false },
    dueness: { dueNow: true },
  };
}

const MAKTABA_ANN = {
  diac: "مَكْتَبَةٌ",
  skeleton: "مكتبة",
  vowelState: "full",
  morphology: {
    lemma: "مَكْتَبَة",
    root: "ك ت ب",
    pattern: "مَفْعَلَة",
    pos: "NOUN",
    gloss: "library",
  },
};

const KABIRA_ANN = {
  diac: "كَبِيرَةٌ",
  skeleton: "كبيرة",
  vowelState: "full",
  morphology: {
    lemma: "كَبِير",
    root: "ك ب ر",
    pattern: "فَعِيل",
    pos: "ADJ",
    gloss: "big",
  },
};

let seq = 0;
const nextId = () => `ar-story-t${seq++}`;

export const arPortableStoryLeg: PortableStoryLeg = {
  lang: "ar",
  entry: arRendererEntry,
  statuses: ["new", "learning", "known"],

  makeToken(band, level, status) {
    return {
      id: nextId(),
      text: MAKTABA_ANN.diac,
      lang: "ar",
      kind: "word",
      status,
      band,
      annotations: MAKTABA_ANN,
      directive: vowelDirective(LEMMA_UNIT, level, level),
    };
  },

  splitFade: {
    tokens: [
      {
        id: "ar-split-lexfaded",
        text: KABIRA_ANN.diac,
        lang: "ar",
        kind: "word",
        status: "learning",
        band: "GREEN",
        annotations: KABIRA_ANN,
        // lexical FADED × case-ending FULL → bare skeleton + tanwīn.
        directive: vowelDirective(KABIRA_UNIT, "faded", "full"),
      },
      {
        id: "ar-split-casefaded",
        text: KABIRA_ANN.diac,
        lang: "ar",
        kind: "word",
        status: "learning",
        band: "GREEN",
        annotations: KABIRA_ANN,
        // lexical FULL × case-ending FADED → vocalized body, no tanwīn.
        directive: vowelDirective(KABIRA_UNIT, "full", "faded"),
      },
    ],
    expectRendered: ["كبيرةٌ", "كَبِيرَة"],
    // The fully vocalized form must appear in NEITHER rendering — the two
    // ḥarakāt classes fade independently (the AC's two-dimension proof).
    forbidRendered: ["كَبِيرَةٌ"],
  },

  discontinuousSpan: {
    spanGroup: "sg:ar-story:0",
    tokens: [
      {
        id: "ar-span-a",
        text: MAKTABA_ANN.diac,
        lang: "ar",
        kind: "word",
        status: "new",
        band: "GREEN",
        spanGroup: "sg:ar-story:0",
        annotations: MAKTABA_ANN,
        directive: vowelDirective(LEMMA_UNIT, "full", "full"),
      },
      {
        id: "ar-span-mid",
        text: "و",
        lang: "ar",
        kind: "punct",
        band: "GREEN",
      },
      {
        id: "ar-span-b",
        text: KABIRA_ANN.diac,
        lang: "ar",
        kind: "word",
        status: "new",
        band: "GREEN",
        spanGroup: "sg:ar-story:0",
        annotations: KABIRA_ANN,
        directive: vowelDirective(KABIRA_UNIT, "full", "full"),
      },
    ],
  },

  expect: {
    containerDir: "rtl",
    bidiIsolatedTokens: true,
    usesRuby: false,
  },
};
