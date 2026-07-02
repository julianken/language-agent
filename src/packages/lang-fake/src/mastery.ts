/**
 * The fake mastery model (seam 4) — the MAX-topology declaration
 * (ADR §4.3): 2 unit kinds (`word` + `glyph`, mirroring zh word/character),
 * 3 fade dimensions, 1 gating edge (glyph units gate `glyphHint`, the
 * fake's segmental-pinyin analog), and 1 declared credit-leak edge
 * (`meaning` leaks through a shown `glyphHint` — the zh
 * meaning/segmentalPinyin rule's generic form).
 *
 * `applyEvidence` implements THE LEAK LAW COMPLETELY — both halves
 * (see `CreditLeakEdge` in @la/contract for the binding statement):
 *
 * 1. Universal same-dimensional half: evidence on a dimension earns a
 *    delta only when that dimension's own `renderedScaffold` echo is
 *    explicitly `'hidden'` (fail-closed: a `'shown'` or MISSING echo earns
 *    nothing — stricter than the law's letter, which only forbids
 *    `'shown'`; a pack may be stricter, never looser).
 * 2. Declared cross-dimensional half: additionally, no delta when any
 *    declared leaking dimension's echo is `'shown'` (an absent echo means
 *    "that scaffold was never rendered", which does not leak).
 */

import { z } from "zod";
import type {
  FadeDimId,
  FadeLevel,
  LearningEvent,
  MasteryDeclarations,
  MasteryModel,
  MasteryModelFactory,
  ScaffoldDirective,
  UnitRef,
  UnitState,
  UnitStateDelta,
  UnitStateMap,
} from "@la/contract";
import { unitKey } from "@la/contract";
import { FakeAnnSchema } from "./annotations.js";

// --- durable state shapes ---------------------------------------------------

/** `word` state, v2 (v1 was `{ timesSeen }` — see `migrateWordState`). */
export const WordStateSchema = z.object({
  seen: z.number().int().nonnegative(),
  stressSeen: z.number().int().nonnegative(),
  mastered: z.boolean(),
});
export type WordState = z.infer<typeof WordStateSchema>;

const WordStateV1Schema = z.object({ timesSeen: z.number().int().nonnegative() });

/** Pure and TOTAL over all declared prior versions (TCK law, ADR §1.4). */
export function migrateWordState(fromVersion: number, state: unknown): unknown {
  if (fromVersion === 1) {
    const v1 = WordStateV1Schema.parse(state);
    return { seen: v1.timesSeen, stressSeen: 0, mastered: false } satisfies WordState;
  }
  if (fromVersion === 2) return WordStateSchema.parse(state);
  throw new Error(
    `lang-fake word state: no migration from version ${fromVersion}`,
  );
}

/** `glyph` state, v1 — a BKT-flavored P(known). */
export const GlyphStateSchema = z.object({ p: z.number().min(0).max(1) });
export type GlyphState = z.infer<typeof GlyphStateSchema>;

const INITIAL_WORD: WordState = { seen: 0, stressSeen: 0, mastered: false };
const INITIAL_GLYPH: GlyphState = { p: 0 };
const MASTERED_AT_SEEN = 5;
const GLYPH_FADED_AT = 0.8;
const GLYPH_PARTIAL_AT = 0.4;
const STRESS_FADED_AT = 3;

// --- declarations (the static half deriveCapabilities/TCK read) ------------

export const fakeMasteryDeclarations: MasteryDeclarations = {
  unitKinds: [
    {
      kind: "word",
      stateSchema: WordStateSchema,
      stateVersion: 2,
      migrateState: migrateWordState,
    },
    {
      kind: "glyph",
      stateSchema: GlyphStateSchema,
      stateVersion: 1,
    },
  ],
  fadeDimensions: ["meaning", "glyphHint", "stressMark"],
  gatingEdges: [{ gatingUnitKind: "glyph", gatedDimension: "glyphHint" }],
  creditLeakEdges: [
    { evidenceDimension: "meaning", leakingDimension: "glyphHint" },
  ],
};

// --- evidence ----------------------------------------------------------------

export const FakeEventPayloadSchema = z.object({
  schemaId: z.literal("fake-events/v1"),
  /** The dimension this evidence bears on. */
  dimension: z.string().min(1),
});

/** Which unit kind a dimension's evidence updates. */
const DIMENSION_TARGET_KIND: Record<FadeDimId, "word" | "glyph"> = {
  meaning: "word",
  glyphHint: "glyph",
  stressMark: "word",
};

function creditEarned(
  dimension: FadeDimId,
  rendered: LearningEvent["renderedScaffold"],
): boolean {
  // Half 1 — universal same-dimensional (fail-closed: explicit 'hidden' only).
  if (rendered[dimension] !== "hidden") return false;
  // Half 2 — declared cross-dimensional edges ADD protection on top.
  for (const edge of fakeMasteryDeclarations.creditLeakEdges) {
    if (
      edge.evidenceDimension === dimension &&
      rendered[edge.leakingDimension] === "shown"
    ) {
      return false;
    }
  }
  return true;
}

function applyEvidence(
  events: LearningEvent[],
  states: UnitStateMap,
): UnitStateDelta[] {
  const working = new Map<string, { unit: UnitRef; state: WordState | GlyphState }>();

  const currentWord = (unit: UnitRef): WordState => {
    const held = working.get(unitKey(unit))?.state;
    if (held) return held as WordState;
    const row = states.get(unitKey(unit));
    const parsed = row ? WordStateSchema.safeParse(row.state) : undefined;
    return parsed?.success ? parsed.data : INITIAL_WORD;
  };
  const currentGlyph = (unit: UnitRef): GlyphState => {
    const held = working.get(unitKey(unit))?.state;
    if (held) return held as GlyphState;
    const row = states.get(unitKey(unit));
    const parsed = row ? GlyphStateSchema.safeParse(row.state) : undefined;
    return parsed?.success ? parsed.data : INITIAL_GLYPH;
  };

  for (const event of events) {
    const payload = FakeEventPayloadSchema.safeParse(event.payload);
    if (!payload.success) continue;
    const dimension = payload.data.dimension;
    const targetKind = DIMENSION_TARGET_KIND[dimension];
    if (!targetKind) continue;
    if (!creditEarned(dimension, event.renderedScaffold)) continue;

    for (const unit of event.unitRefs) {
      if (unit.kind !== targetKind) continue;
      if (targetKind === "word") {
        const prev = currentWord(unit);
        const next: WordState =
          dimension === "meaning"
            ? {
                ...prev,
                seen: prev.seen + 1,
                mastered: prev.seen + 1 >= MASTERED_AT_SEEN,
              }
            : { ...prev, stressSeen: prev.stressSeen + 1 };
        working.set(unitKey(unit), { unit, state: next });
      } else {
        const prev = currentGlyph(unit);
        const next: GlyphState = { p: Math.min(1, prev.p + 0.2) };
        working.set(unitKey(unit), { unit, state: next });
      }
    }
  }

  return [...working.values()].map(({ unit, state }) => ({
    unit,
    stateVersion: unit.kind === "word" ? 2 : 1,
    state,
  }));
}

// --- scaffold plan -----------------------------------------------------------

function wordFadeLevel(state: WordState): FadeLevel {
  if (state.mastered) return "faded";
  if (state.seen > 0) return "partial";
  return "full";
}

function glyphFadeLevel(state: GlyphState): FadeLevel {
  if (state.p >= GLYPH_FADED_AT) return "faded";
  if (state.p >= GLYPH_PARTIAL_AT) return "partial";
  return "full";
}

// --- the model ---------------------------------------------------------------

export const fakeMasteryModel: MasteryModelFactory = {
  declarations: fakeMasteryDeclarations,
  make(_ctx): MasteryModel {
    return {
      ...fakeMasteryDeclarations,

      unitsForToken(_token, ann) {
        const parsed = FakeAnnSchema.safeParse(ann);
        if (!parsed.success) return [];
        return [
          { kind: "word", id: parsed.data.lexemeId },
          ...parsed.data.glyphs.map((g) => ({
            kind: "glyph",
            id: g.glyph,
          })),
        ];
      },

      // The fake declares no secondary indexes and propagates no evidence
      // beyond the turn's tokens (index-selector propagation is Arabic's
      // root-prior pattern — ADR §1.4).
      affectedUnits(_events) {
        return [];
      },

      applyEvidence,

      /**
       * Per-(dimension × unit) directives (ADR §1.4): `glyphHint` is keyed
       * PER GLYPH UNIT within the token — the gating edge's semantics: a
       * mastered glyph's hint fades while an unmastered glyph's stays, in
       * the SAME token (the 銀行 case, faked).
       */
      scaffoldPlan(token, states): ScaffoldDirective {
        const wordUnit = token.units.find((u) => u.kind === "word");
        const glyphUnits = token.units.filter((u) => u.kind === "glyph");
        const fadeLevels: ScaffoldDirective["fadeLevels"] = [];
        let anglicize = true;
        let dueNow = false;

        if (wordUnit) {
          const row = states.get(unitKey(wordUnit));
          const parsed = row ? WordStateSchema.safeParse(row.state) : undefined;
          const state = parsed?.success ? parsed.data : INITIAL_WORD;
          const meaningLevel = wordFadeLevel(state);
          fadeLevels.push({ dim: "meaning", unit: wordUnit, level: meaningLevel });
          fadeLevels.push({
            dim: "stressMark",
            unit: wordUnit,
            level: state.stressSeen >= STRESS_FADED_AT ? "faded" : "full",
          });
          anglicize = meaningLevel === "full";
          dueNow = !state.mastered;
        }
        for (const glyphUnit of glyphUnits) {
          const row = states.get(unitKey(glyphUnit));
          const parsed = row ? GlyphStateSchema.safeParse(row.state) : undefined;
          const state = parsed?.success ? parsed.data : INITIAL_GLYPH;
          fadeLevels.push({
            dim: "glyphHint",
            unit: glyphUnit,
            level: glyphFadeLevel(state),
          });
        }
        return {
          fadeLevels,
          blend: { anglicize },
          dueness: { dueNow },
        };
      },

      /** Deterministic: every hydrated, un-mastered word unit is due
       * (sorted by key so output order never depends on map order). */
      dueUnits(states, _now) {
        const due: UnitRef[] = [];
        for (const [key, row] of [...states.entries()].sort(([a], [b]) =>
          a.localeCompare(b),
        )) {
          if (!key.startsWith("word/")) continue;
          const parsed = WordStateSchema.safeParse(row.state);
          if (parsed.success && !parsed.data.mastered) {
            due.push({ kind: "word", id: key.slice("word/".length) });
          }
        }
        return due;
      },
    };
  },
};
