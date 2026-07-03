import { describe, expect, it } from "vitest";
import type { UnitStateMap } from "@la/contract";
import type { ArAnnotations } from "../annotations.js";
import { AR_FADE_DIMENSIONS, arMasteryModel } from "../mastery.js";

function ctx() {
  return {
    sidecar: { baseUrl: "http://127.0.0.1:0" },
    assets: { read: () => Promise.reject(new Error("not used")) },
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    config: {},
    fsrs: {},
  };
}

const MAKTABA: ArAnnotations = {
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

describe("arMasteryModel — declaration", () => {
  it("declares the lemma unit kind, ar's three ADR §1.4 fade dimensions, and zero gating/leak edges", () => {
    expect(arMasteryModel.declarations.unitKinds.map((k) => k.kind)).toEqual(["lemma"]);
    expect(arMasteryModel.declarations.fadeDimensions).toEqual([...AR_FADE_DIMENSIONS]);
    expect(arMasteryModel.declarations.gatingEdges).toEqual([]);
    expect(arMasteryModel.declarations.creditLeakEdges).toEqual([]);
  });
});

describe("arMasteryModel.unitsForToken", () => {
  it("decodes the morphology payload into the arLemmaUnitRef convention (lemma#gloss)", () => {
    const model = arMasteryModel.make(ctx());
    const spine = { id: "t1", lang: "ar" as const, surface: MAKTABA.diac, kind: "word", status: "new", band: "GREEN" as const };
    expect(model.unitsForToken(spine, MAKTABA)).toEqual([
      { kind: "lemma", id: "مَكْتَبَة#library" },
    ]);
  });

  it("returns no units when the annotations carry no morphology (e.g. undecoded input)", () => {
    const model = arMasteryModel.make(ctx());
    const spine = { id: "t1", lang: "ar" as const, surface: "x", kind: "punct", status: "new", band: "GREEN" as const };
    expect(model.unitsForToken(spine, undefined)).toEqual([]);
  });
});

describe("arMasteryModel.scaffoldPlan", () => {
  it("never reads learner state — a throwing UnitStateMap proxy must not throw", () => {
    const model = arMasteryModel.make(ctx());
    const throwingStates = new Proxy(new Map(), {
      get() {
        throw new Error("scaffoldPlan must never read learner state");
      },
    }) as unknown as UnitStateMap;
    const spine = { id: "t1", lang: "ar" as const, surface: MAKTABA.diac, kind: "word", status: "new", band: "GREEN" as const };
    const units = model.unitsForToken(spine, MAKTABA);
    expect(() => model.scaffoldPlan({ spine, annotations: MAKTABA, units }, throwingStates)).not.toThrow();
  });

  it("englishBlend's fade level tracks blend.anglicize (full when anglicized, faded when kept in Arabic)", () => {
    const model = arMasteryModel.make(ctx());
    const spine = { id: "t1", lang: "ar" as const, surface: MAKTABA.diac, kind: "word", status: "new", band: "GREEN" as const };
    const units = model.unitsForToken(spine, MAKTABA);
    const directive = model.scaffoldPlan({ spine, annotations: MAKTABA, units }, new Map());
    const englishBlendEntry = directive.fadeLevels.find((f) => f.dim === "englishBlend");
    expect(englishBlendEntry).toBeDefined();
    expect(englishBlendEntry?.level).toBe(directive.blend.anglicize ? "full" : "faded");
  });

  it("stamps both vowel dimensions per-unit at the constant 'full' level (the walking skeleton shows every ḥaraka)", () => {
    const model = arMasteryModel.make(ctx());
    const spine = { id: "t1", lang: "ar" as const, surface: MAKTABA.diac, kind: "word", status: "new", band: "GREEN" as const };
    const units = model.unitsForToken(spine, MAKTABA);
    const directive = model.scaffoldPlan({ spine, annotations: MAKTABA, units }, new Map());
    const lexical = directive.fadeLevels.find((f) => f.dim === "vowelFadeLexical");
    const caseEnding = directive.fadeLevels.find((f) => f.dim === "vowelFadeCaseEnding");
    expect(lexical?.level).toBe("full");
    expect(caseEnding?.level).toBe("full");
  });
});
