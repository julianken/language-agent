/**
 * The `zh` leg of the shared portable-stories suite (ADR §4.2 seam-6 test
 * category): this pack's fixture tokens for the generic story states —
 * each band × fade stage × learner status, plus the per-unit split-fade
 * story and the discontinuous-span story. The SHARED story file lives
 * with the shell (`src/apps/web/src/stories/portable-stories.tsx`) and is
 * written against the contract; each language instantiates it with a leg
 * like this one (mirrors `@la/lang-ar/src/react/story-leg.ts`).
 *
 * **Instantiation residual (stated explicitly, mirroring this issue's
 * `e2e-turn.test.ts` scope decision):** `src/apps/web/src/stories/
 * __tests__/portable-stories.test.tsx`'s `LEGS` table currently lists
 * `[arPortableStoryLeg, fakePortableStoryLeg]` only. That file sits
 * outside this issue's sanctioned-edit list (mirrors the e2e-turn.test.ts
 * `LEGS` tension exactly — a shared web-app test file, not named in the
 * dispatch brief's edit list), so this pack exports `zhPortableStoryLeg`
 * (this module) for a future PR to plug in, but does NOT itself add a
 * `LEGS` entry there. Stated honestly in this PR's Test plan rather than
 * silently claimed.
 *
 * zh has no `spanGroup`/離合詞 coverage in v0 (Decision 3 / #20's C6 sliver
 * constraint strikes it) — `discontinuousSpan` below reuses two ordinary,
 * non-grouped tokens with an empty `spanGroup` id purely to satisfy the
 * shared interface's shape; `@la/lang-fake`'s discontinuous-span story
 * stays the REAL exercised case (ADR §4.3's zh-probe-set note).
 */

import type { Band, FadeLevel, ScaffoldDirective, UnitRef } from "@la/contract";
import type { ZhAnnotations } from "../annotations.js";
import { zhRendererEntry } from "./entry.js";
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

const KEYI_UNIT: UnitRef = { kind: "word", id: "可以:ke3yi3" };
const HAO_UNIT: UnitRef = { kind: "word", id: "好:hao3" };
const KE_CHAR: UnitRef = { kind: "character", id: "可" };
const YI_CHAR: UnitRef = { kind: "character", id: "以" };

function directive(
  wordUnit: UnitRef,
  meaningLevel: FadeLevel,
  characterLevels: Array<{ unit: UnitRef; level: FadeLevel }>,
): ScaffoldDirective {
  return {
    fadeLevels: [
      { dim: "meaning", unit: wordUnit, level: meaningLevel },
      ...characterLevels.map(({ unit, level }) => ({ dim: "segmentalPinyin", unit, level })),
    ],
    blend: { anglicize: false },
    dueness: { dueNow: true },
  };
}

const KEYI_ANN: ZhAnnotations = {
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

const HAO_ANN: ZhAnnotations = {
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

let seq = 0;
const nextId = () => `zh-story-t${seq++}`;

export const zhPortableStoryLeg: PortableStoryLeg = {
  lang: "zh",
  entry: zhRendererEntry,
  statuses: ["new", "learning", "known"],

  makeToken(band, level, status) {
    return {
      id: nextId(),
      text: "可以",
      lang: "zh",
      kind: "word",
      status,
      band,
      annotations: KEYI_ANN,
      directive: directive(KEYI_UNIT, level, [
        { unit: KE_CHAR, level },
        { unit: YI_CHAR, level },
      ]),
    };
  },

  splitFade: {
    tokens: [
      {
        id: "zh-split-kefaded",
        text: "可以",
        lang: "zh",
        kind: "word",
        status: "learning",
        band: "GREEN",
        annotations: KEYI_ANN,
        // 可's segmental pinyin FADED, 以's FULL — per-character independence.
        directive: directive(KEYI_UNIT, "faded", [
          { unit: KE_CHAR, level: "faded" },
          { unit: YI_CHAR, level: "full" },
        ]),
      },
      {
        id: "zh-split-yifaded",
        text: "可以",
        lang: "zh",
        kind: "word",
        status: "learning",
        band: "GREEN",
        annotations: KEYI_ANN,
        // 可's segmental pinyin FULL, 以's FADED — the mirror case.
        directive: directive(KEYI_UNIT, "faded", [
          { unit: KE_CHAR, level: "full" },
          { unit: YI_CHAR, level: "faded" },
        ]),
      },
    ],
    // Each rendering shows exactly ONE of the two surface syllables —
    // proof the two character units fade independently (the S1b-lesson
    // per-unit AC).
    expectRendered: ["yǐ", "ké"],
    forbidRendered: ["kéyǐ"],
  },

  // zh v0 has no real spanGroup case (see file header) — a placeholder
  // pair only, to satisfy the shared interface's shape.
  discontinuousSpan: {
    spanGroup: "sg:zh-story:none",
    tokens: [
      {
        id: "zh-span-a",
        text: "好",
        lang: "zh",
        kind: "word",
        status: "new",
        band: "GREEN",
        annotations: HAO_ANN,
        directive: directive(HAO_UNIT, "full", [{ unit: { kind: "character", id: "好" }, level: "full" }]),
      },
      {
        id: "zh-span-mid",
        text: "，",
        lang: "zh",
        kind: "punct",
        band: "GREEN",
      },
      {
        id: "zh-span-b",
        text: "可以",
        lang: "zh",
        kind: "word",
        status: "new",
        band: "GREEN",
        annotations: KEYI_ANN,
        directive: directive(KEYI_UNIT, "full", [
          { unit: KE_CHAR, level: "full" },
          { unit: YI_CHAR, level: "full" },
        ]),
      },
    ],
  },

  expect: {
    containerDir: "ltr",
    bidiIsolatedTokens: false,
    usesRuby: true,
  },
};
