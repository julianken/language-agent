/**
 * The fake steering policy (seam 2). `anglicizeDown` is PURE and obeys the
 * three TCK laws (ADR §4.2): subtraction-safety (target segments are only
 * ever carried from the input, never minted), allowlist inviolability
 * (span-grouped tokens — the fake's separable-verb/system-morpheme
 * allowlist analog — are NEVER anglicized, under any directives), and
 * frame preservation (segment order mirrors token order; non-anglicized
 * tokens pass through unchanged).
 */

import type {
  BlendedStream,
  ScaffoldDirective,
  SteeringPolicy,
  VerifiedToken,
} from "@la/contract";
import type { PackContext } from "@la/contract";
import type { FakeAnn } from "./annotations.js";

export function makeFakeSteering(_ctx: PackContext): SteeringPolicy<FakeAnn> {
  return {
    generationConstraints(plan) {
      return {
        instructions: [
          "fake: use only closed-lexicon words",
          ...plan.intents.map((intent) => `express: ${intent.id}`),
        ],
      };
    },

    /** Deterministic pack-semantic ranking term: prefer denser candidates
     * (more whitespace chunks). */
    scoreCandidate(candidate, _snapshot) {
      return candidate.text.trim().split(/\s+/u).filter((c) => c.length > 0)
        .length;
    },

    anglicizeDown(
      stream: VerifiedToken<FakeAnn>[],
      directives: ScaffoldDirective[],
    ): BlendedStream<FakeAnn> {
      return {
        segments: stream.map((token, i) => {
          const directive = directives[i];
          const allowlisted = token.spine.spanGroup !== undefined;
          if (!allowlisted && directive?.blend.anglicize === true) {
            return {
              kind: "english" as const,
              text: token.annotations.gloss,
              replaced: [{ kind: "word", id: token.annotations.lexemeId }],
            };
          }
          return { kind: "target" as const, token };
        }),
      };
    },
  };
}
