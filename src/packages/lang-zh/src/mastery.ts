/**
 * `@la/lang-zh`'s seam-4 `MasteryModel` — the `FixedRatioScaffold`
 * stand-in (ADR §5.2 #9 pattern, extended to zh by this issue): constant
 * per-(dimension × unit) directives, NO learner-state reads on the turn
 * path — mirrors `@la/lang-ar/src/mastery.ts` exactly. Authored HERE,
 * pack-local — NOT in `@la/engine` — because fade interpretation is
 * exclusively pack-owned (ADR §1.5, enforced by
 * `scripts/check-no-engine-fade.sh`).
 *
 * **The v0 declaration branch (read this before touching gatingEdges /
 * creditLeakEdges):** this pack DECLARES the two-latent SHAPE design
 * §2/§3 names — two unit kinds (`word` word-FSRS, `character` per-
 * character BKT) and the three fade dimensions (`meaning`,
 * `segmentalPinyin`, `tone`) — because that declaration is cheap, static
 * data with no live-coupling cost. It does NOT declare the `character`→
 * `segmentalPinyin` GATING edge or the `meaning`←`segmentalPinyin`
 * CREDIT-LEAK edge design §2.2/§2.3 also names. Those two edges express a
 * REAL, state-reactive coupling (driving a character to mastered must
 * actually fade that character's pinyin scaffold) that the walking
 * skeleton's FixedRatioScaffold — constant directives, no state reads —
 * cannot honestly implement; declaring the edges without implementing the
 * coupling would make the TCK's mastery-gating law either FALSELY pass
 * (if the law were vacuous) or FAIL against this pack's own conformance
 * suite (it is not vacuous once an edge is declared — `describe-language-
 * pack.ts`'s Law 1 iterates every DECLARED `GatingEdge` and requires a
 * real per-unit response). This is the SAME shape of decision the
 * §7.3 dual-coverage-floor trap forced explicit in `curriculum.ts`
 * (PR #28's vacuous-pass lesson), applied to the mastery seam: the ADR's
 * dual-instance amendment Decision 3 resolves it identically — "both real
 * packs bind FixedRatioScaffold + the seam-5 bypass, so mastery-graph …
 * TCK categories run against the fake ALONE until Phase 3 wires real
 * mastery." `@la/lang-fake` already exercises BOTH edges non-vacuously
 * (its `glyph`→`glyphHint` gating edge and `meaning`←`glyphHint` leak
 * edge are explicitly documented as "the zh segmental-pinyin analog" /
 * "the zh meaning/segmentalPinyin rule's generic form") — that is where
 * the two-latent COUPLING law is proven sound pre-zh. This pack's real
 * coupling — and its two declared edges — is Phase-3 work.
 *
 * (NOTE: `docs/decisions/language-module-architecture.md` §1.4's body text
 * — "zh = 2 kinds, 3 dims, 1 edge" — was written before the dual-instance
 * amendment settled this v0/Phase-3 split and reads as present-tense. It
 * is not one of the three doc-reconciliation spots this PR's issue named,
 * so it is left untouched here per that exact sanctioned-edit list; flagged
 * in the PR body as a residual discrepancy for a future doc pass.)
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
  UnitStateDelta,
  UnitStateMap,
} from "@la/contract";
import { unitKey } from "@la/contract";
import type { ZhAnnotations } from "./annotations.js";
import {
  ZH_CHARACTER_UNIT_KIND,
  ZH_FADE_DIMS,
  ZH_WORD_UNIT_KIND,
  zhCharacterUnitRefs,
  zhWordUnitRef,
} from "./react/ruby.js";

/** The turn-loop's fixed English/Chinese blend target for `word`-kind,
 * blend-eligible tokens (walking-skeleton stand-in, mirrors ar's
 * `AR_TARGET_BLEND_RATIO`). */
export const ZH_TARGET_BLEND_RATIO = 0.4;

/** ADR §1.4's declared zh fade-dimension set, verbatim. */
export const ZH_FADE_DIMENSIONS = [
  ZH_FADE_DIMS.meaning,
  ZH_FADE_DIMS.segmentalPinyin,
  ZH_FADE_DIMS.tone,
] as const satisfies readonly FadeDimId[];

/** Trivial durable state for `word` units: a non-negative "seen" counter
 * (mirrors ar's `SeenCountStateSchema`). */
export const WordSeenStateSchema = z.object({ seen: z.number().int().nonnegative() });
export type WordSeenState = z.infer<typeof WordSeenStateSchema>;

/** Trivial durable state for `character` units: a BKT-flavored P(known)
 * stand-in (mirrors `@la/lang-fake`'s `GlyphStateSchema` — the fake's
 * documented zh-character analog). Declared so `applyEvidence`/`dueUnits`
 * are fully law-compliant, even though `scaffoldPlan` never reads it back
 * (file header: no gating edge is declared in v0). */
export const CharacterSeenStateSchema = z.object({ seen: z.number().int().nonnegative() });
export type CharacterSeenState = z.infer<typeof CharacterSeenStateSchema>;

const INITIAL_WORD: WordSeenState = { seen: 0 };
const INITIAL_CHARACTER: CharacterSeenState = { seen: 0 };
/** Arbitrary "due" cutoff — cosmetic only (ADR §1.5 #9 stub scope; nothing
 * downstream reads dueness for scaffold planning in the skeleton). */
const DUE_UNTIL_SEEN = 3;

/** 32-bit FNV-1a, normalized to [0, 1) — mirrors ar's `stableUnitFraction`,
 * a stable BUCKETING function, not a security primitive. */
function stableUnitFraction(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0xffffffff;
}

/** `true` (anglicize → render in English) with probability
 * `1 - ZH_TARGET_BLEND_RATIO`, deterministically keyed on `unitId` — a
 * PURE, DETERMINISTIC function of the token's own word-unit id, never a
 * learner-state read (mirrors ar's `hashRatioSelect`). */
export function hashRatioSelect(unitId: string, targetRatio: number): boolean {
  return stableUnitFraction(unitId) >= targetRatio;
}

const evidencePayloadDimension = (payload: unknown): string | undefined => {
  if (typeof payload !== "object" || payload === null) return undefined;
  const dimension = (payload as Record<string, unknown>)["dimension"];
  return typeof dimension === "string" ? dimension : undefined;
};

const declarations: MasteryDeclarations = {
  unitKinds: [
    { kind: ZH_WORD_UNIT_KIND, stateSchema: WordSeenStateSchema, stateVersion: 1 },
    { kind: ZH_CHARACTER_UNIT_KIND, stateSchema: CharacterSeenStateSchema, stateVersion: 1 },
  ],
  fadeDimensions: [...ZH_FADE_DIMENSIONS],
  // v0 declares NO gating/leak edges — see file header. Both halves of the
  // universal same-dimensional leak law still hold unconditionally below.
  gatingEdges: [],
  creditLeakEdges: [],
};

export const zhMasteryModel: MasteryModelFactory = {
  declarations,
  make(_ctx): MasteryModel {
    return {
      ...declarations,

      unitsForToken(_spine, ann) {
        const parsed = ann as ZhAnnotations | undefined;
        if (!parsed) return [];
        const characterUnits = zhCharacterUnitRefs(parsed);
        if (parsed.readingId !== undefined) {
          return [zhWordUnitRef(parsed.readingId), ...characterUnits];
        }
        // C3 single-kind function words carry no word-level reading
        // identity (design: they are grammatical particles, not
        // Latent-W-tracked content words) — character unit(s) only.
        return characterUnits;
      },

      affectedUnits: (_events: LearningEvent[]) => [],

      applyEvidence(events: LearningEvent[], states: UnitStateMap): UnitStateDelta[] {
        const working = new Map<
          string,
          { unit: UnitRef; kind: typeof ZH_WORD_UNIT_KIND | typeof ZH_CHARACTER_UNIT_KIND; state: WordSeenState | CharacterSeenState }
        >();
        const currentOf = (unit: UnitRef, initial: WordSeenState | CharacterSeenState, schema: typeof WordSeenStateSchema) => {
          const held = working.get(unitKey(unit))?.state;
          if (held) return held;
          const row = states.get(unitKey(unit));
          const parsed = row ? schema.safeParse(row.state) : undefined;
          return parsed?.success ? parsed.data : initial;
        };
        for (const event of events) {
          const dimension = evidencePayloadDimension(event.payload);
          if (dimension === undefined) continue;
          // THE LEAK LAW, universal same-dimensional half (ADR §1.4):
          // fail-closed — only an explicit 'hidden' echo earns credit.
          // zh declares zero creditLeakEdges (file header), so there is
          // no cross-dimensional half to additionally honor.
          if (event.renderedScaffold[dimension] !== "hidden") continue;
          const targetKind =
            dimension === ZH_FADE_DIMS.meaning
              ? ZH_WORD_UNIT_KIND
              : dimension === ZH_FADE_DIMS.segmentalPinyin
                ? ZH_CHARACTER_UNIT_KIND
                : undefined; // 'tone' evidence: no durable state in v0
          if (targetKind === undefined) continue;
          for (const unit of event.unitRefs) {
            if (unit.kind !== targetKind) continue;
            if (targetKind === ZH_WORD_UNIT_KIND) {
              const prev = currentOf(unit, INITIAL_WORD, WordSeenStateSchema) as WordSeenState;
              working.set(unitKey(unit), { unit, kind: ZH_WORD_UNIT_KIND, state: { seen: prev.seen + 1 } });
            } else {
              const prev = currentOf(unit, INITIAL_CHARACTER, CharacterSeenStateSchema) as CharacterSeenState;
              working.set(unitKey(unit), { unit, kind: ZH_CHARACTER_UNIT_KIND, state: { seen: prev.seen + 1 } });
            }
          }
        }
        return [...working.values()].map(({ unit, state }) => ({
          unit,
          stateVersion: 1,
          state,
        }));
      },

      scaffoldPlan(token, _states): ScaffoldDirective {
        // NO STATE READ: `_states` is deliberately unused — every fade
        // level is constant or a pure function of the unit's own id (file
        // header: the two-latent COUPLING is Phase-3 work). Mechanically
        // verified: mastery.test.ts passes a throwing `UnitStateMap` proxy
        // here and asserts it never throws.
        const wordUnit = token.units.find((u) => u.kind === ZH_WORD_UNIT_KIND);
        const characterUnits = token.units.filter((u) => u.kind === ZH_CHARACTER_UNIT_KIND);
        const anglicize = wordUnit ? hashRatioSelect(wordUnit.id, ZH_TARGET_BLEND_RATIO) : false;

        const fadeLevels: ScaffoldDirective["fadeLevels"] = [];
        if (wordUnit) {
          const level: FadeLevel = anglicize ? "full" : "faded";
          fadeLevels.push({ dim: ZH_FADE_DIMS.meaning, unit: wordUnit, level });
        }
        for (const unit of characterUnits) {
          // Constant "full" — segmental pinyin is not yet mastery-gated in
          // v0 (no declared gating edge; the ruby band always shows).
          fadeLevels.push({ dim: ZH_FADE_DIMS.segmentalPinyin, unit, level: "full" });
          // Tone is faded LAST in the design (§3.1 dim 3) and stays
          // constant "full" (early diacritic-on-letter state) in v0 —
          // there is no live tone-mastery signal yet.
          fadeLevels.push({ dim: ZH_FADE_DIMS.tone, unit, level: "full" });
        }
        return {
          fadeLevels,
          blend: { anglicize },
          dueness: { dueNow: true },
        };
      },

      dueUnits(states: UnitStateMap, _now: Date): UnitRef[] {
        const due: UnitRef[] = [];
        for (const [key, row] of [...states.entries()].sort(([a], [b]) => a.localeCompare(b))) {
          const isWord = key.startsWith(`${ZH_WORD_UNIT_KIND}/`);
          const isCharacter = key.startsWith(`${ZH_CHARACTER_UNIT_KIND}/`);
          if (!isWord && !isCharacter) continue;
          const kind = isWord ? ZH_WORD_UNIT_KIND : ZH_CHARACTER_UNIT_KIND;
          const parsed = (isWord ? WordSeenStateSchema : CharacterSeenStateSchema).safeParse(row.state);
          if (parsed.success && parsed.data.seen < DUE_UNTIL_SEEN) {
            due.push({ kind, id: key.slice(kind.length + 1) });
          }
        }
        return due;
      },
    };
  },
};
