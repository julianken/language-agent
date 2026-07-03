/**
 * `@la/lang-ar`'s seam-4 `MasteryModel` — the `FixedRatioScaffold` stand-in
 * (ADR §5.2 #9: constant per-(dimension × unit) directives, no learner-state
 * reads). Authored HERE, pack-local — NOT in `@la/engine` — because fade
 * interpretation is exclusively pack-owned (ADR §1.5, enforced by
 * `scripts/check-no-engine-fade.sh`, scoped to `src/packages/engine` +
 * `src/apps/web/src/shell`): a generic engine-side factory that stamps
 * `FadeLevel` values would itself be the violation this gate exists to
 * catch. `@la/engine`'s seam-5 stand-in (`makeSeedVocabBypassCurriculum`)
 * carries no fade vocabulary and stays shared there; this seam-4 stand-in
 * does not shift the same way — a future zh pack (#21) authors its own copy
 * following this same pattern (ADR §6's two-implementation rule: sharing
 * is earned by a second concrete demonstration, not assumed up front).
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
import type { ArAnnotations } from "./annotations.js";
import { AR_LEMMA_UNIT_KIND, AR_VOWEL_DIMS, arLemmaUnitRef } from "./react/harakat.js";

/** The turn-loop's fixed English/Arabic blend target (walking-skeleton
 * stand-in for the real mastery-driven blend engine, `architecture.md` §4 —
 * explicitly out of this epic's scope). A beginner-leaning blend: roughly
 * 40% of eligible content words render in Arabic, 60% in English, in
 * expectation over the seed-vocab's lemma-id distribution (see
 * `hashRatioSelect` below). */
export const AR_TARGET_BLEND_RATIO = 0.4;

/** ADR §1.4's declared ar fade-dimension set, verbatim: the blend decision
 * itself (`englishBlend`) plus the two vowel sub-tracks. */
export const AR_FADE_DIMENSIONS = [
  "englishBlend",
  AR_VOWEL_DIMS.lexical,
  AR_VOWEL_DIMS.caseEnding,
] as const satisfies readonly FadeDimId[];

/** Trivial durable state: a single non-negative "seen" counter. Declared so
 * `applyEvidence`/`dueUnits` are fully law-compliant (TCK migration + leak
 * laws), even though `scaffoldPlan` never reads it back — the walking
 * skeleton's fade decisions are constant by design (file header). */
export const SeenCountStateSchema = z.object({ seen: z.number().int().nonnegative() });
export type SeenCountState = z.infer<typeof SeenCountStateSchema>;

const INITIAL_STATE: SeenCountState = { seen: 0 };
/** Arbitrary "due" cutoff — a unit seen this many times or more drops out
 * of the due queue. Cosmetic only: nothing downstream reads dueness for
 * scaffold planning in the skeleton (ADR §1.5 #9 stub scope). */
const DUE_UNTIL_SEEN = 3;

/** 32-bit FNV-1a, normalized to [0, 1). Pure, deterministic, no crypto
 * dependency — a stable BUCKETING function, not a security primitive. */
function stableUnitFraction(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0xffffffff;
}

/**
 * `true` (anglicize → render in English) with probability
 * `1 - AR_TARGET_BLEND_RATIO`, deterministically keyed on `unitId` — a
 * PURE, DETERMINISTIC function of the token's own lemma-kind unit id, never
 * a learner-state read, never turn-scoped counting (this mastery-model
 * instance is wired ONCE at boot by `composeApp` and lives for the app's
 * lifetime, so a turn-scoped counter would leak across turns and
 * learners). Across a vocabulary of many distinct units the fraction
 * rendered in the target language converges to `AR_TARGET_BLEND_RATIO` in
 * expectation, while any single unit's decision never changes across turns
 * or learners — a genuinely CONSTANT directive.
 */
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
    { kind: AR_LEMMA_UNIT_KIND, stateSchema: SeenCountStateSchema, stateVersion: 1 },
  ],
  fadeDimensions: [...AR_FADE_DIMENSIONS],
  // ar declares zero edges and keeps full same-dimensional leak coverage
  // (ADR §1.4).
  gatingEdges: [],
  creditLeakEdges: [],
};

export const arMasteryModel: MasteryModelFactory = {
  declarations,
  make(_ctx): MasteryModel {
    return {
      ...declarations,

      unitsForToken(_spine, ann) {
        const morphology = (ann as ArAnnotations | undefined)?.morphology;
        return morphology ? [arLemmaUnitRef(morphology)] : [];
      },

      affectedUnits: (_events: LearningEvent[]) => [],

      applyEvidence(events: LearningEvent[], states: UnitStateMap): UnitStateDelta[] {
        const working = new Map<string, { unit: UnitRef; state: SeenCountState }>();
        const current = (unit: UnitRef): SeenCountState => {
          const held = working.get(unitKey(unit))?.state;
          if (held) return held;
          const row = states.get(unitKey(unit));
          const parsed = row ? SeenCountStateSchema.safeParse(row.state) : undefined;
          return parsed?.success ? parsed.data : INITIAL_STATE;
        };
        for (const event of events) {
          const dimension = evidencePayloadDimension(event.payload);
          if (dimension === undefined) continue;
          // THE LEAK LAW, universal same-dimensional half (ADR §1.4):
          // fail-closed — only an explicit 'hidden' echo earns credit. ar
          // declares zero creditLeakEdges, so there is no cross-dimensional
          // half to additionally honor.
          if (event.renderedScaffold[dimension] !== "hidden") continue;
          for (const unit of event.unitRefs) {
            if (unit.kind !== AR_LEMMA_UNIT_KIND) continue;
            const prev = current(unit);
            working.set(unitKey(unit), { unit, state: { seen: prev.seen + 1 } });
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
        // header). Mechanically verified: mastery.test.ts passes a
        // throwing `UnitStateMap` proxy here and asserts it never throws.
        const lemmaUnit = token.units.find((u) => u.kind === AR_LEMMA_UNIT_KIND);
        const anglicize = lemmaUnit
          ? hashRatioSelect(lemmaUnit.id, AR_TARGET_BLEND_RATIO)
          : false;

        const fadeLevels: ScaffoldDirective["fadeLevels"] = [];
        for (const unit of token.units) {
          if (unit.kind !== AR_LEMMA_UNIT_KIND) continue;
          for (const dim of declarations.fadeDimensions) {
            // englishBlend IS the blend decision as a declared fade
            // dimension (ADR §1.4): full when anglicized to English, faded
            // when kept in Arabic. The two vowel dimensions default to
            // "full" — the walking skeleton shows every ḥaraka; real
            // vowel-fade-by-mastery is seam-4's real-Arabic-implementation
            // work, out of this epic.
            const level: FadeLevel =
              dim === "englishBlend" ? (anglicize ? "full" : "faded") : "full";
            fadeLevels.push({ dim, unit, level });
          }
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
          if (!key.startsWith(`${AR_LEMMA_UNIT_KIND}/`)) continue;
          const parsed = SeenCountStateSchema.safeParse(row.state);
          if (parsed.success && parsed.data.seen < DUE_UNTIL_SEEN) {
            due.push({ kind: AR_LEMMA_UNIT_KIND, id: key.slice(AR_LEMMA_UNIT_KIND.length + 1) });
          }
        }
        return due;
      },
    };
  },
};
