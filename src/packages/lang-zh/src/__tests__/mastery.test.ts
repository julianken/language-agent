import { describe, expect, it } from "vitest";
import type { UnitStateMap } from "@la/contract";
import type { ZhAnnotations } from "../annotations.js";
import { ZH_FADE_DIMENSIONS, zhMasteryModel } from "../mastery.js";

function ctx() {
  return {
    sidecar: { baseUrl: "http://127.0.0.1:0" },
    assets: { read: () => Promise.reject(new Error("not used")) },
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    config: {},
    fsrs: {},
  };
}

const KEYI: ZhAnnotations = {
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

const DE_SINGLE: ZhAnnotations = {
  perCharacter: [{ char: "的", citationPinyinChar: "de", compositionalBoundFlag: false }],
  citationPinyin: ["de"],
  surfacePinyin: ["de"],
  toneTrack: [5],
  neutralToneSlots: [0],
  erhuaSlots: [],
  contextKey: "我|的|茶",
  boundMorpheme: false,
};

describe("zhMasteryModel — declaration", () => {
  it("declares BOTH unit kinds (word, character), zh's three fade dimensions, and ZERO gating/leak edges (v0 deferral — see mastery.ts header)", () => {
    expect(zhMasteryModel.declarations.unitKinds.map((k) => k.kind)).toEqual(["word", "character"]);
    expect(zhMasteryModel.declarations.fadeDimensions).toEqual([...ZH_FADE_DIMENSIONS]);
    expect(zhMasteryModel.declarations.gatingEdges).toEqual([]);
    expect(zhMasteryModel.declarations.creditLeakEdges).toEqual([]);
  });
});

describe("zhMasteryModel.unitsForToken", () => {
  it("maps a word-kind token to one word unit PLUS one character unit per Han character (zh: one token → 1 word unit + N character units)", () => {
    const model = zhMasteryModel.make(ctx());
    const spine = { id: "t1", lang: "zh" as const, surface: "可以", kind: "word", status: "new", band: "GREEN" as const };
    expect(model.unitsForToken(spine, KEYI)).toEqual([
      { kind: "word", id: "可以:ke3yi3" },
      { kind: "character", id: "可" },
      { kind: "character", id: "以" },
    ]);
  });

  it("maps a single-kind (C3 function-word) token to ONLY its character unit — no word-level reading identity", () => {
    const model = zhMasteryModel.make(ctx());
    const spine = { id: "t1", lang: "zh" as const, surface: "的", kind: "single", status: "new", band: "GREEN" as const };
    expect(model.unitsForToken(spine, DE_SINGLE)).toEqual([{ kind: "character", id: "的" }]);
  });

  it("returns no units for annotations carrying no per-character data (e.g. undecoded input)", () => {
    const model = zhMasteryModel.make(ctx());
    const spine = { id: "t1", lang: "zh" as const, surface: "x", kind: "punct", status: "new", band: "GREEN" as const };
    expect(model.unitsForToken(spine, undefined)).toEqual([]);
  });
});

describe("zhMasteryModel.scaffoldPlan", () => {
  it("never reads learner state — a throwing UnitStateMap proxy must not throw (FixedRatioScaffold, v0)", () => {
    const model = zhMasteryModel.make(ctx());
    const throwingStates = new Proxy(new Map(), {
      get() {
        throw new Error("scaffoldPlan must never read learner state");
      },
    }) as unknown as UnitStateMap;
    const spine = { id: "t1", lang: "zh" as const, surface: "可以", kind: "word", status: "new", band: "GREEN" as const };
    const units = model.unitsForToken(spine, KEYI);
    expect(() => model.scaffoldPlan({ spine, annotations: KEYI, units }, throwingStates)).not.toThrow();
  });

  it("meaning's fade level tracks blend.anglicize (full when anglicized, faded when kept in Chinese)", () => {
    const model = zhMasteryModel.make(ctx());
    const spine = { id: "t1", lang: "zh" as const, surface: "可以", kind: "word", status: "new", band: "GREEN" as const };
    const units = model.unitsForToken(spine, KEYI);
    const directive = model.scaffoldPlan({ spine, annotations: KEYI, units }, new Map());
    const meaningEntry = directive.fadeLevels.find((f) => f.dim === "meaning");
    expect(meaningEntry).toBeDefined();
    expect(meaningEntry?.level).toBe(directive.blend.anglicize ? "full" : "faded");
  });

  it("stamps segmentalPinyin and tone PER CHARACTER unit at the constant 'full' level (v0: no gating edge declared, ruby always shows)", () => {
    const model = zhMasteryModel.make(ctx());
    const spine = { id: "t1", lang: "zh" as const, surface: "可以", kind: "word", status: "new", band: "GREEN" as const };
    const units = model.unitsForToken(spine, KEYI);
    const directive = model.scaffoldPlan({ spine, annotations: KEYI, units }, new Map());
    const keSegmental = directive.fadeLevels.find((f) => f.dim === "segmentalPinyin" && f.unit.id === "可");
    const yiSegmental = directive.fadeLevels.find((f) => f.dim === "segmentalPinyin" && f.unit.id === "以");
    expect(keSegmental?.level).toBe("full");
    expect(yiSegmental?.level).toBe("full");
    const keTone = directive.fadeLevels.find((f) => f.dim === "tone" && f.unit.id === "可");
    expect(keTone?.level).toBe("full");
  });

  it("single-kind tokens (no word unit) stamp no 'meaning' entry, only per-character segmentalPinyin/tone", () => {
    const model = zhMasteryModel.make(ctx());
    const spine = { id: "t1", lang: "zh" as const, surface: "的", kind: "single", status: "new", band: "GREEN" as const };
    const units = model.unitsForToken(spine, DE_SINGLE);
    const directive = model.scaffoldPlan({ spine, annotations: DE_SINGLE, units }, new Map());
    expect(directive.fadeLevels.some((f) => f.dim === "meaning")).toBe(false);
    expect(directive.fadeLevels.find((f) => f.dim === "segmentalPinyin" && f.unit.id === "的")?.level).toBe("full");
  });
});

describe("zhMasteryModel.applyEvidence — the universal same-dimensional leak law half", () => {
  it("a hidden-echo 'meaning' event earns a word-unit delta; a shown-echo one earns nothing", () => {
    const model = zhMasteryModel.make(ctx());
    const unit = { kind: "word", id: "可以:ke3yi3" };
    const hiddenEvent = {
      tokenRef: "t1",
      unitRefs: [unit],
      renderedScaffold: { meaning: "hidden" as const },
      payload: { schemaId: "zh-events/v1", dimension: "meaning" },
    };
    const shownEvent = {
      ...hiddenEvent,
      renderedScaffold: { meaning: "shown" as const },
    };
    expect(model.applyEvidence([hiddenEvent], new Map())).toEqual([
      { unit, stateVersion: 1, state: { seen: 1 } },
    ]);
    expect(model.applyEvidence([shownEvent], new Map())).toEqual([]);
  });
});
