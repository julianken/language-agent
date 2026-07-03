/**
 * `@la/lang-ar`'s seam-2 `SteeringPolicy` — generation constraints (prompt
 * hints for `claude-sonnet-5`, per `docs/research/arabic-validation.md`
 * §5/§9: high/formal MSA register, full vocalization, self-annotated
 * lemma+gloss) and `anglicizeDown` (subtraction-safe, pure — ADR §4.2's
 * anglicize triple).
 *
 * `anglicizeDown`'s allowlist (never-anglicize) member is structural, not a
 * separate declared list: non-`word` tokens (punctuation, numerals) are
 * NEVER anglicized regardless of directive — there is no English
 * equivalent to swap in, and v0 MSA segmentation mints no discontinuous
 * `spanGroup` units (`src/sidecars/ar/app/gate.py`: "v0 MSA segmentation
 * mints no discontinuous learnable units").
 */

import type {
  BlendedStream,
  PackContext,
  ScaffoldDirective,
  SteeringPolicy,
  VerifiedToken,
} from "@la/contract";
import type { ArAnnotations } from "./annotations.js";
import { arLemmaUnitRef } from "./react/harakat.js";

export function makeArSteering(_ctx: PackContext): SteeringPolicy<ArAnnotations> {
  return {
    generationConstraints(plan) {
      return {
        instructions: [
          "Write in high/formal Modern Standard Arabic (MSA) — news/official register; never colloquial, never Qur'anic-archaic (docs/research/arabic-validation.md §9).",
          "Fully vocalize every word: every ḥaraka and tanwīn present. The verification gate requires a complete diacritized surface form; an unvocalized or partially-vocalized token cannot be verified.",
          "For every content word, know the intended lemma and its English gloss — the gate verifies the emitted vocalization against your intended sense, not merely 'valid Arabic'.",
          "Prefer vocabulary named in this turn's intents; do not introduce untaught technical, colloquial, or dialectal terms.",
          "Never splice an English word into an Arabic construct-state (iḍāfa) or attach an Arabic clitic (ال، بـ، لـ، وـ، فـ) to a non-Arabic stem — insert whole noun phrases or verbs only at clause boundaries.",
          ...plan.intents.map((intent) => `Express: ${intent.description}`),
        ],
      };
    },

    /** Deterministic pack-semantic ranking term: prefer denser candidates
     * (more whitespace-delimited chunks), the same simple tie-breaker
     * `@la/lang-fake` uses. */
    scoreCandidate(candidate, _snapshot) {
      return candidate.text.trim().split(/\s+/u).filter((c) => c.length > 0).length;
    },

    anglicizeDown(
      stream: VerifiedToken<ArAnnotations>[],
      directives: ScaffoldDirective[],
    ): BlendedStream<ArAnnotations> {
      return {
        segments: stream.map((token, i) => {
          const directive = directives[i];
          const isWord = token.spine.kind === "word";
          if (isWord && directive?.blend.anglicize === true) {
            return {
              kind: "english" as const,
              text: token.annotations.morphology.gloss,
              replaced: [arLemmaUnitRef(token.annotations.morphology)],
            };
          }
          return { kind: "target" as const, token };
        }),
      };
    },
  };
}
