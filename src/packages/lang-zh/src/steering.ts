/**
 * `@la/lang-zh`'s seam-2 `SteeringPolicy` — generation constraints
 * (zh-specific prompt hints) and `anglicizeDown` (subtraction-safe, pure —
 * ADR §4.2's anglicize triple), mirroring `@la/lang-ar`'s `steering.ts`.
 *
 * The never-anglicize allowlist (design §4.4) is realized structurally,
 * not as a separate declared list, mirroring ar's approach: (a) only
 * `word`-kind tokens are ever anglicize-eligible — `single`-kind C3
 * function words (的/了/不/一/嗎/呢), punctuation, digits, and RED/
 * regenerate-candidate tokens carry no `gloss` and are therefore never
 * touched; (b) within `word`-kind tokens, `pos === "classifier"` and
 * `pos === "numeral"` are hard-excluded — design §4.3's own worked example
 * ("three 本 book — the classifier 本 AND THE NUMERAL stay Chinese; only
 * 'book' is English") keeps BOTH the classifier and the numeral in the
 * Chinese matrix. Matrix-Language-Frame discipline (design §4.2): Chinese
 * is the Matrix Language (word order + every system morpheme); the
 * anglicized English fills a bare content slot only — never restructures
 * the clause, never pluralizes, never adds English function morphology
 * (the subtraction itself does none of that; it swaps one gloss string
 * for one glyph run, per token, in place).
 */

import type {
  BlendedStream,
  PackContext,
  ScaffoldDirective,
  SteeringPolicy,
  VerifiedToken,
} from "@la/contract";
import type { ZhAnnotations } from "./annotations.js";
import { zhWordUnitRef } from "./react/ruby.js";

/** Word-kind parts of speech that stay Chinese at every fade level
 * (design §4.3/§4.4) — the sanctioned system-morpheme classes present
 * among #20's 58-word sliver's `word`-kind tokens. */
const NEVER_ANGLICIZE_POS = new Set(["classifier", "numeral"]);

export function makeZhSteering(_ctx: PackContext): SteeringPolicy<ZhAnnotations> {
  return {
    generationConstraints(plan) {
      return {
        instructions: [
          "Write in Traditional-script Standard Written Chinese (Taiwan/HK/Macau publishing register) — never Simplified.",
          "Read every word with its Mainland Putonghua pronunciation, even where Taiwan usage differs (design's locked north-star tradeoff, e.g. 和 as hé not hàn, 垃圾 as lājī not lèsè) — the vocabulary spine is Taiwan-register (TOCFL/SC-TOP), but the reading standard is Putonghua throughout.",
          "Stay within the TOCFL/SC-TOP band the learner is at; do not introduce words outside the seed known-set this walking skeleton is bounded to.",
          "Chinese is the Matrix Language: it supplies word order and every system morpheme (classifiers, aspect particles, negation, structural particles). English may only fill a bare content-word slot — never restructure the clause, never import English function morphology.",
          ...plan.intents.map((intent) => `Express: ${intent.description}`),
        ],
      };
    },

    /** Deterministic pack-semantic ranking term: prefer denser candidates
     * (more characters), the same simple tie-breaker `@la/lang-fake` and
     * `@la/lang-ar` use, adapted to a non-whitespace-delimited script. */
    scoreCandidate(candidate, _snapshot) {
      return [...candidate.text].filter((c) => !/\s/u.test(c)).length;
    },

    anglicizeDown(
      stream: VerifiedToken<ZhAnnotations>[],
      directives: ScaffoldDirective[],
    ): BlendedStream<ZhAnnotations> {
      return {
        segments: stream.map((token, i) => {
          const directive = directives[i];
          const ann = token.annotations;
          const isWord = token.spine.kind === "word";
          const posProtected = ann.pos !== undefined && NEVER_ANGLICIZE_POS.has(ann.pos);
          if (
            isWord &&
            !posProtected &&
            ann.gloss !== undefined &&
            ann.readingId !== undefined &&
            directive?.blend.anglicize === true
          ) {
            return {
              kind: "english" as const,
              text: ann.gloss,
              replaced: [zhWordUnitRef(ann.readingId)],
            };
          }
          return { kind: "target" as const, token };
        }),
      };
    },
  };
}
