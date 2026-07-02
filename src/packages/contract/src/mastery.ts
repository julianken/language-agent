/**
 * Seam 4 — the mastery seam (ADR §1.4): module-declared learnable-unit
 * graph + per-(dimension × unit) scaffold directives.
 *
 * The failure mode this refuses: a shared mastery state shape. Arabic is
 * one per-(user, lemma, sense) latent with FSRS; Chinese is two coupled
 * latents (word-FSRS + per-character BKT) where C gates the pinyin fade of
 * W's tokens. So the contract exposes BEHAVIOR and a DECLARED GRAPH, never
 * internals.
 */

import type { z } from "zod";
import type { TokenSpine } from "./spine.js";
import type {
  FadeDimId,
  LearningEvent,
  ScaffoldDirective,
  UnitKey,
  UnitRef,
} from "./scaffold.js";
import type { PackContext } from "./pack-context.js";

/**
 * A pack-declared secondary index the engine maintains at write time
 * (e.g. Arabic's `root` index, which is how the LOCKED root-prior reaches
 * sibling lemma-units NOT present in the turn — ADR §1.4).
 */
export interface UnitIndexDecl {
  id: string;
  extract(state: unknown): string;
}

/**
 * Declaration of one learnable-unit kind. Learner state is DURABLE and NOT
 * re-derivable (contrast annotations, which re-derive on a `schemaId`
 * bump), so evolution machinery is part of the declaration from v0
 * (ADR §1.4, §3.5):
 *
 * - `stateVersion` — the version rows of this kind are written at.
 * - `migrateState` — pure; must be TOTAL over all declared prior versions
 *   (TCK law). The engine runs it on version-skewed rows at read.
 */
export interface UnitKindDecl {
  kind: string;
  /** Validates a state row of this kind at its declared version. */
  stateSchema: z.ZodType;
  stateVersion: number;
  migrateState?(fromVersion: number, state: unknown): unknown;
  indexes?: UnitIndexDecl[];
}

/**
 * A declared gating edge: units of `gatingUnitKind` gate the fade of
 * `gatedDimension` on the tokens they compose (zh: character units gate
 * `segmentalPinyin`; ar declares none — ADR §1.4).
 */
export interface GatingEdge {
  gatingUnitKind: string;
  gatedDimension: FadeDimId;
}

/**
 * A declared CROSS-DIMENSIONAL credit-leak edge: evidence on
 * `evidenceDimension` earns NO state delta for it on impressions where the
 * scaffold of `leakingDimension` (a DIFFERENT dimension) was `'shown'`,
 * per the `LearningEvent.renderedScaffold` echo. This is the declared-edge
 * generalization of the zh leak-free credit rule
 * (chinese-instance-design.md §2.3 — meaning-credit only on pinyin-hidden
 * impressions): zh declares
 * `{ evidenceDimension: 'meaning', leakingDimension: 'segmentalPinyin' }`.
 *
 * THE LEAK LAW — both halves, and how they compose:
 *
 * 1. **Universal same-dimensional half (undeclared; runs for EVERY fade
 *    dimension of EVERY pack).** Evidence on a dimension whose own
 *    `renderedScaffold` entry was `'shown'` produces no delta for that
 *    dimension. This half PERSISTS regardless of what a pack declares —
 *    no `CreditLeakEdge` is needed for it, and a pack declaring ZERO
 *    edges (Arabic: `creditLeakEdges: []`) keeps FULL same-dimensional
 *    leak coverage.
 * 2. **Declared cross-dimensional half.** Each declared `CreditLeakEdge`
 *    ADDS cross-dimensional protection ON TOP of the universal half —
 *    declared edges never replace, narrow, or opt out of it.
 *
 * A self-edge (`evidenceDimension === leakingDimension`) is therefore a
 * redundant restatement of half 1 and is REJECTED by the manifest schema:
 * same-dimensional protection is universal, not declarable. The TCK (#17)
 * tests half 1 over every declared fade dimension and half 2 over whatever
 * edges the pack declares.
 */
export interface CreditLeakEdge {
  /** The dimension the evidence bears on (the credit being protected). */
  evidenceDimension: FadeDimId;
  /** The OTHER dimension whose shown scaffold leaks that credit. */
  leakingDimension: FadeDimId;
}

/**
 * The DECLARATION half of the mastery seam — static data the engine, the
 * TCK, and `deriveCapabilities` read WITHOUT instantiating the behavior
 * half (ADR §2.2 requires `deriveCapabilities(pack)` to be a pure function
 * over the un-instantiated manifest). It drives generic storage
 * (key/validate/index/migrate) and the generic law tests.
 */
export interface MasteryDeclarations {
  /** ar: 1 kind (`lemma-sense`, with a `root` index); zh: 2 kinds
   * (`word`, `character`). */
  unitKinds: UnitKindDecl[];
  /** ar: `['englishBlend','vowelFadeLexical','vowelFadeCaseEnding']`;
   * zh: `['meaning','segmentalPinyin','tone']`. */
  fadeDimensions: FadeDimId[];
  /** zh: `[{ gatingUnitKind:'character', gatedDimension:'segmentalPinyin' }]`;
   * ar: `[]`. */
  gatingEdges: GatingEdge[];
  /** Declared cross-dimensional credit-leak edges — see
   * {@link CreditLeakEdge} for the full leak law (the universal
   * same-dimensional half persists for every pack; these edges only ADD).
   * zh: `[{ evidenceDimension:'meaning', leakingDimension:'segmentalPinyin' }]`;
   * ar: `[]` (and keeps full same-dimensional coverage). */
  creditLeakEdges: CreditLeakEdge[];
}

/** One durable state row for a unit, at its kind's declared version. */
export interface UnitState {
  stateVersion: number;
  state: unknown;
}

/**
 * Hydrated unit states for one `applyEvidence` / `scaffoldPlan` call,
 * keyed by the canonical `unitKey(ref)` encoding. Plain data on purpose —
 * the behavior functions are pack-PURE (TCK law: `applyEvidence` is pure).
 */
export type UnitStateMap = ReadonlyMap<UnitKey, UnitState>;

/** A new state row the engine validates (against the kind's declared
 * schema) and persists. */
export interface UnitStateDelta {
  unit: UnitRef;
  stateVersion: number;
  state: unknown;
}

/**
 * Selector for units evidence touches BEYOND the turn's tokens
 * (ADR §1.4 `affectedUnits`): either a direct ref, or an index form
 * resolved via a declared secondary index — how ar's root-prior reaches
 * sibling lemma-units not present in the turn.
 */
export type UnitSelector =
  | UnitRef
  | { kind: string; index: string; value: string };

/** The token-scoped input to `scaffoldPlan`. */
export interface TokenContext {
  spine: TokenSpine;
  /** The token's annotation payload (opaque here; the pack decodes it via
   * its own codec schema). */
  annotations: unknown;
  /** The token's units, as previously mapped by `unitsForToken`. */
  units: UnitRef[];
}

/**
 * Seam 4 port (ADR §1.4). Declarations are readable on the instance too
 * (they are spread from the factory's static half — the two MUST agree);
 * behavior functions are pack-pure: state is opaque to the engine.
 */
export interface MasteryModel extends MasteryDeclarations {
  /** zh maps one token → 1 word unit + N character units. */
  unitsForToken(token: TokenSpine, ann: unknown): UnitRef[];
  /** Hydration hook: which ADDITIONAL units this evidence touches, beyond
   * the turn's tokens. */
  affectedUnits(events: LearningEvent[]): UnitSelector[];
  /** Pure (TCK law). MUST honor the leak law — BOTH halves; see
   * {@link CreditLeakEdge}. */
  applyEvidence(events: LearningEvent[], states: UnitStateMap): UnitStateDelta[];
  /** Emits per-(dimension × unit) fade levels — the zh W⊗C coupling lives
   * INSIDE this function; the engine never knows characters exist. */
  scaffoldPlan(token: TokenContext, states: UnitStateMap): ScaffoldDirective;
  /** Feeds the shared scheduler cascade; monotone under time (TCK law). */
  dueUnits(states: UnitStateMap, now: Date): UnitRef[];
}

/**
 * The seam-4 factory (ADR §1.2). Object-shaped, unlike the plain-function
 * factories of seams 1/2/7, because this seam carries a DECLARATION half
 * that `deriveCapabilities`, the engine's tuple store, and the TCK must
 * read without a `PackContext` (ADR §2.2): `declarations` is that static
 * half; `make` closes over the narrow context (e.g. `ctx.fsrs`) and
 * returns the behavior half. The returned instance re-carries the same
 * declarations (spread them — one source) per §1.4's single-interface
 * shape.
 */
export interface MasteryModelFactory {
  declarations: MasteryDeclarations;
  make(ctx: PackContext): MasteryModel;
}
