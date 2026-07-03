/**
 * Seam-agnostic candidate generation (ADR §1.5: the generic per-turn shape
 * is "candidates(1..N) → cheap-rank → gate the winner"). The engine never
 * talks to an LLM provider directly — `CandidateGenerator` is the injected
 * boundary the composition root binds to a concrete implementation (the real
 * Anthropic client, or the deterministic replay/fixture client that makes
 * the PR-blocking E2E fully deterministic — ADR §3.6). Language-blind:
 * text in, text out; the pack's `steeringPolicy.generationConstraints`
 * supplies the prompt hints, never this port.
 */

import type { PromptConstraints, TurnPlan } from "@la/contract";

/** One request for N candidate target-language texts. */
export interface GenerateCandidatesArgs {
  /** The learner's raw English turn — the only free-text input to generation. */
  learnerMessage: string;
  /** The turn plan (seam-2 input) — carries the turn's intents. */
  plan: TurnPlan;
  /** seam-2's generation constraints for this turn (prompt-assembly hints). */
  constraints: PromptConstraints;
  /** How many candidates to request. N=1 in the walking skeleton (ADR §1.5);
   * both committed language specs lock oversample-and-rank N=3–5 later — the
   * port already accepts N>1 so that change is a constant, not a rework. */
  n: number;
}

/** One generated candidate — pre-gate, pre-annotation. */
export interface GeneratedCandidate {
  text: string;
}

/**
 * The injected generation boundary. Implementations: `AnthropicCandidateGenerator`
 * (real `claude-sonnet-5` structured-output calls, server-owned) and
 * `ReplayCandidateGenerator` (deterministic recorded responses per matrix leg,
 * server-owned) — both live in `src/apps/server` (never here), since the
 * engine itself must stay free of any concrete LLM SDK dependency (ADR
 * "Engine-owned, language-blind, imports only `@la/contract`").
 */
export interface CandidateGenerator {
  generate(args: GenerateCandidatesArgs): Promise<GeneratedCandidate[]>;
}
