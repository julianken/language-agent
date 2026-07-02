import { describe, expect, it } from "vitest";
import type { LearningEvent, UnitState, UnitStateMap } from "@la/contract";
import { unitKey } from "@la/contract";
import {
  WordStateSchema,
  fakeMasteryDeclarations,
  fakeMasteryModel,
  migrateWordState,
} from "../mastery.js";
import { makeTestContext } from "./test-context.js";

const model = fakeMasteryModel.make(makeTestContext());

const states = (
  entries: Array<[{ kind: string; id: string }, UnitState]>,
): UnitStateMap => new Map(entries.map(([ref, s]) => [unitKey(ref), s]));

const meaningEvent = (
  rendered: LearningEvent["renderedScaffold"],
  unitRefs = [{ kind: "word", id: "zip" }],
): LearningEvent => ({
  tokenRef: "t0",
  unitRefs,
  renderedScaffold: rendered,
  payload: { schemaId: "fake-events/v1", dimension: "meaning" },
});

describe("lang-fake mastery — MAX-topology declarations (AC: 2 kinds + 1 gating edge + 1 credit-leak edge + 3 fade dimensions)", () => {
  it("declares exactly the max topology", () => {
    expect(fakeMasteryDeclarations.unitKinds.map((k) => k.kind)).toEqual([
      "word",
      "glyph",
    ]);
    expect(fakeMasteryDeclarations.fadeDimensions).toEqual([
      "meaning",
      "glyphHint",
      "stressMark",
    ]);
    expect(fakeMasteryDeclarations.gatingEdges).toEqual([
      { gatingUnitKind: "glyph", gatedDimension: "glyphHint" },
    ]);
    expect(fakeMasteryDeclarations.creditLeakEdges).toEqual([
      { evidenceDimension: "meaning", leakingDimension: "glyphHint" },
    ]);
  });

  it("re-carries the declarations on the instantiated model (factory and instance agree)", () => {
    expect(model.unitKinds).toEqual(fakeMasteryDeclarations.unitKinds);
    expect(model.fadeDimensions).toEqual(fakeMasteryDeclarations.fadeDimensions);
    expect(model.gatingEdges).toEqual(fakeMasteryDeclarations.gatingEdges);
    expect(model.creditLeakEdges).toEqual(
      fakeMasteryDeclarations.creditLeakEdges,
    );
  });

  it("maps one token onto 1 word unit + N glyph units (the zh word/character shape)", () => {
    const units = model.unitsForToken(
      {
        id: "t0",
        lang: "fake",
        surface: "zip",
        kind: "word",
        status: "new",
        band: "GREEN",
      },
      {
        lexemeId: "zip",
        gloss: "one",
        glyphs: [
          { glyph: "z", hint: "Z" },
          { glyph: "i", hint: "I" },
          { glyph: "p", hint: "P" },
        ],
      },
    );
    expect(units).toEqual([
      { kind: "word", id: "zip" },
      { kind: "glyph", id: "z" },
      { kind: "glyph", id: "i" },
      { kind: "glyph", id: "p" },
    ]);
  });
});

describe("lang-fake mastery — THE LEAK LAW, half 1: universal same-dimensional (no declaration needed)", () => {
  it("grants NO meaning delta when the meaning scaffold itself was shown", () => {
    const deltas = model.applyEvidence(
      [meaningEvent({ meaning: "shown", glyphHint: "hidden" })],
      states([]),
    );
    expect(deltas).toEqual([]);
  });

  it("grants NO delta when the dimension's echo is missing (fail-closed: stricter than the law's letter, never looser)", () => {
    const deltas = model.applyEvidence(
      [meaningEvent({ glyphHint: "hidden" })],
      states([]),
    );
    expect(deltas).toEqual([]);
  });

  it("applies to EVERY dimension without an edge declared for it — stressMark evidence on a shown stressMark earns nothing", () => {
    const deltas = model.applyEvidence(
      [
        {
          tokenRef: "t0",
          unitRefs: [{ kind: "word", id: "zip" }],
          renderedScaffold: { stressMark: "shown" },
          payload: { schemaId: "fake-events/v1", dimension: "stressMark" },
        },
      ],
      states([]),
    );
    expect(deltas).toEqual([]);
  });

  it("control: hidden-scaffold meaning evidence DOES earn a word delta", () => {
    const deltas = model.applyEvidence(
      [meaningEvent({ meaning: "hidden", glyphHint: "hidden" })],
      states([]),
    );
    expect(deltas).toEqual([
      {
        unit: { kind: "word", id: "zip" },
        stateVersion: 2,
        state: { seen: 1, stressSeen: 0, mastered: false },
      },
    ]);
  });
});

describe("lang-fake mastery — THE LEAK LAW, half 2: the declared cross-dimensional edge ADDS protection on top", () => {
  it("grants NO meaning delta when the DECLARED leaking dimension (glyphHint) was shown, even with meaning hidden", () => {
    const deltas = model.applyEvidence(
      [meaningEvent({ meaning: "hidden", glyphHint: "shown" })],
      states([]),
    );
    expect(deltas).toEqual([]);
  });

  it("the edge is directional: glyphHint evidence still earns credit when meaning was shown (no reverse edge declared)", () => {
    const deltas = model.applyEvidence(
      [
        {
          tokenRef: "t0",
          unitRefs: [{ kind: "glyph", id: "z" }],
          renderedScaffold: { meaning: "shown", glyphHint: "hidden" },
          payload: { schemaId: "fake-events/v1", dimension: "glyphHint" },
        },
      ],
      states([]),
    );
    expect(deltas).toEqual([
      { unit: { kind: "glyph", id: "z" }, stateVersion: 1, state: { p: 0.2 } },
    ]);
  });

  it("an absent leaking-dimension echo does not leak (never rendered ≠ shown)", () => {
    const deltas = model.applyEvidence(
      [meaningEvent({ meaning: "hidden" })],
      states([]),
    );
    expect(deltas).toHaveLength(1);
  });
});

describe("lang-fake mastery — evidence accumulation and mastery threshold", () => {
  it("accumulates across events and flips mastered at the threshold", () => {
    const zip = { kind: "word", id: "zip" };
    const deltas = model.applyEvidence(
      [meaningEvent({ meaning: "hidden", glyphHint: "hidden" })],
      states([[zip, { stateVersion: 2, state: { seen: 4, stressSeen: 0, mastered: false } }]]),
    );
    expect(deltas).toEqual([
      {
        unit: zip,
        stateVersion: 2,
        state: { seen: 5, stressSeen: 0, mastered: true },
      },
    ]);
  });

  it("applyEvidence is pure — inputs are never mutated", () => {
    const zip = { kind: "word", id: "zip" };
    const input = states([
      [zip, { stateVersion: 2, state: { seen: 1, stressSeen: 0, mastered: false } }],
    ]);
    const events = [meaningEvent({ meaning: "hidden", glyphHint: "hidden" })];
    model.applyEvidence(events, input);
    expect(input.get(unitKey(zip))?.state).toEqual({
      seen: 1,
      stressSeen: 0,
      mastered: false,
    });
    expect(events[0]?.renderedScaffold).toEqual({
      meaning: "hidden",
      glyphHint: "hidden",
    });
  });
});

describe("lang-fake mastery — per-(dimension × unit) scaffold plan (AC: ≥1 per-unit fade within a token)", () => {
  it("fades a mastered glyph's hint while keeping an unmastered glyph's FULL, inside ONE token (the 銀行 case, faked)", () => {
    const token = {
      spine: {
        id: "t0",
        lang: "fake" as const,
        surface: "zip",
        kind: "word",
        status: "new",
        band: "GREEN" as const,
      },
      annotations: {
        lexemeId: "zip",
        gloss: "one",
        glyphs: [
          { glyph: "z", hint: "Z" },
          { glyph: "i", hint: "I" },
          { glyph: "p", hint: "P" },
        ],
      },
      units: [
        { kind: "word", id: "zip" },
        { kind: "glyph", id: "z" },
        { kind: "glyph", id: "i" },
        { kind: "glyph", id: "p" },
      ],
    };
    const directive = model.scaffoldPlan(
      token,
      states([
        [{ kind: "glyph", id: "z" }, { stateVersion: 1, state: { p: 0.9 } }],
        [{ kind: "glyph", id: "i" }, { stateVersion: 1, state: { p: 0.5 } }],
        // p for 'p' left unhydrated → initial (0) → full
      ]),
    );
    const glyphLevels = directive.fadeLevels.filter((f) => f.dim === "glyphHint");
    expect(glyphLevels).toEqual([
      { dim: "glyphHint", unit: { kind: "glyph", id: "z" }, level: "faded" },
      { dim: "glyphHint", unit: { kind: "glyph", id: "i" }, level: "partial" },
      { dim: "glyphHint", unit: { kind: "glyph", id: "p" }, level: "full" },
    ]);
    // The word-level dims are keyed to the WORD unit — (dim × unit), not per token.
    expect(
      directive.fadeLevels.filter((f) => f.unit.kind === "word").map((f) => f.dim),
    ).toEqual(["meaning", "stressMark"]);
  });
});

describe("lang-fake mastery — durable-state evolution (stateVersion + migrateState)", () => {
  it("declares word@v2 with a migration and glyph@v1 without", () => {
    const word = fakeMasteryDeclarations.unitKinds.find((k) => k.kind === "word");
    const glyph = fakeMasteryDeclarations.unitKinds.find((k) => k.kind === "glyph");
    expect(word?.stateVersion).toBe(2);
    expect(word?.migrateState).toBeTypeOf("function");
    expect(glyph?.stateVersion).toBe(1);
    expect(glyph?.migrateState).toBeUndefined();
  });

  it("migrates v1 word state to a v2 row that validates against the declared schema (total over declared priors)", () => {
    const migrated = migrateWordState(1, { timesSeen: 3 });
    expect(WordStateSchema.parse(migrated)).toEqual({
      seen: 3,
      stressSeen: 0,
      mastered: false,
    });
  });

  it("refuses an undeclared prior version loudly", () => {
    expect(() => migrateWordState(0, {})).toThrow(/no migration/);
  });
});

describe("lang-fake mastery — dueUnits", () => {
  it("returns unmastered word units deterministically", () => {
    const due = model.dueUnits(
      states([
        [{ kind: "word", id: "zip" }, { stateVersion: 2, state: { seen: 1, stressSeen: 0, mastered: false } }],
        [{ kind: "word", id: "zap" }, { stateVersion: 2, state: { seen: 5, stressSeen: 0, mastered: true } }],
        [{ kind: "glyph", id: "z" }, { stateVersion: 1, state: { p: 0.1 } }],
      ]),
      new Date("2026-07-02T00:00:00Z"),
    );
    expect(due).toEqual([{ kind: "word", id: "zip" }]);
  });
});
