/**
 * Scaffold directives and the learning-event return channel (ADR §1.4).
 *
 * Directives are keyed by (dimension × unit), NOT one level per dimension
 * per token: the zh spec fades segmental pinyin PER CHARACTER within a word
 * token (銀行 = one token, two character units, two different
 * `segmentalPinyin` levels). Arabic gets the mirror benefit: its
 * lexical-vs-case-ending vowel split is two declared dimensions over the
 * same lemma-sense unit.
 */

import type { TokenId } from "./spine.js";

/**
 * A pack-declared fade dimension id (opaque to the engine).
 * ar: `englishBlend`, `vowelFadeLexical`, `vowelFadeCaseEnding`;
 * zh: `meaning`, `segmentalPinyin`, `tone` (ADR §1.4).
 */
export type FadeDimId = string;

/**
 * The small contract fade enum. The TCK gating law reads it generically
 * ("driving every gating unit to mastered drives its per-unit
 * gated-dimension level to `faded`"); packs interpret it (ADR §1.4).
 */
export type FadeLevel = "full" | "partial" | "faded";

/** A reference to one learnable unit of a declared kind. */
export interface UnitRef {
  /** One of the pack's declared `UnitKindDecl.kind` values. */
  kind: string;
  /** Pack-chosen unit id, unique within its kind. */
  id: string;
}

/**
 * Canonical string key for a `UnitRef` — the deterministic encoding
 * `UnitStateMap` is keyed by. Contract-owned so packs and engine can never
 * disagree on the encoding.
 */
export type UnitKey = string;

/** Encode a `UnitRef` as its canonical `UnitStateMap` key. */
export function unitKey(ref: UnitRef): UnitKey {
  return `${ref.kind}/${ref.id}`;
}

/**
 * Blend decision for one token — whether `anglicizeDown` should render it
 * in English. v0-minimal; widens with the hot path (#9) inside the v0.x
 * churn window.
 */
export interface BlendDecision {
  anglicize: boolean;
}

/** Dueness info stamped for the renderer/scheduler. v0-minimal. */
export interface DueInfo {
  dueNow: boolean;
}

/**
 * The per-token scaffold directive (ADR §1.4): fade levels keyed by
 * (dimension × unit), the blend decision, and dueness. The turn loop stamps
 * it onto the token envelope VERBATIM — there is deliberately no engine
 * "blend engine" applying levels; the only consumers are pack code
 * (`anglicizeDown` and the pack's `/react` components — ADR §1.5).
 */
export interface ScaffoldDirective {
  fadeLevels: Array<{ dim: FadeDimId; unit: UnitRef; level: FadeLevel }>;
  blend: BlendDecision;
  dueness: DueInfo;
}

/**
 * The learning-event spine — the contract-owned return channel from pack UI
 * back to `MasteryModel.applyEvidence` (ADR §1.4), mirroring seam 3's
 * annotation envelope.
 *
 * `renderedScaffold` is the ECHO of the directive actually in force at
 * render time. It exists because credit rules read what the learner
 * actually SAW: the mastery leak law (see {@link CreditLeakEdge} in
 * `mastery.js` for the full statement) grants no credit for evidence on a
 * dimension whose scaffold was shown — and, where a pack declares
 * cross-dimensional credit-leak edges, no credit when a declared leaking
 * dimension's scaffold was shown either.
 */
export interface LearningEvent {
  tokenRef: TokenId;
  unitRefs: UnitRef[];
  /** Echo of the rendered directive: what the learner actually saw, per
   * fade dimension, at the moment the evidence was produced. */
  renderedScaffold: Record<FadeDimId, "shown" | "hidden">;
  /** Module-owned envelope (zh's per-character breathe-down click rides
   * here). `schemaId` names the pack's event-payload schema. */
  payload: { schemaId: string; [k: string]: unknown };
}
