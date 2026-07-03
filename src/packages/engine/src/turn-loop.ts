/**
 * The engine turn loop (ADR §1.5): **generate → verify → anglicize**, built
 * to the generic `candidates(1..N) → cheap-rank → gate the winner` shape
 * with N=1 in the walking skeleton (epic #3 AC) so oversample-and-rank later
 * changes a constant, not this loop's shape or the SSE contract.
 *
 * Language-blind: this module imports ONLY `@la/contract` plus the sibling
 * engine modules — never a `@la/lang-*` package (ADR §2.4 rule a). The
 * never-show-wrong law (ADR §1.5, scoped to the generation path): **no RED
 * token ever reaches `anglicizeDown`** — on any RED, the loop discards the
 * candidate and retries generation (bounded); on exhaustion it falls back
 * to an all-English message. Verification happens strictly BEFORE
 * anglicization (`docs/research/arabic-validation.md` §7: generate → gate →
 * anglicize-DOWN, never generate-then-translate-up).
 */

import type {
  CoverageFloor,
  LanguageId,
  ScaffoldDirective,
  TtsPayload,
  TurnContext,
  TurnIntent,
  TurnPlan,
  UnitStateMap,
  UserSnapshot,
  VerifiedToken,
  VoiceConfig,
} from "@la/contract";
import type { AppPorts } from "./ports.js";
import type { CandidateGenerator, GeneratedCandidate } from "./candidate-generator.js";
import {
  buildEnglishFallbackMessage,
  buildTutorMessage,
  type TutorMessage,
} from "./tutor-message.js";

export interface RunTurnInput {
  /** The learner's raw English turn. */
  learnerMessage: string;
  /** Stable per-message id (caller-assigned; architecture.md §3 requires
   * stable, not merely unique, ids). */
  messageId: string;
  /** The turn's target language (drives `tutor-message.lang` and the
   * ratio's `lang==target` comparison). */
  targetLang: LanguageId;
  /** The learner snapshot passed to `curriculumPolicy`/`scoreCandidate`. */
  snapshot: UserSnapshot;
  /** The turn's communicative intents — sourced from `curriculumPolicy`'s
   * seed-vocab candidates by the composition-root caller (ADR §5.2 #9's
   * curriculum-cascade bypass is exercised THERE, not inside this
   * language-blind loop — see `src/apps/server/src/hot-path.ts`). */
  intents: TurnIntent[];
  /** Voice config forwarded to `ttsDriver.synthesize`. */
  voice: VoiceConfig;
}

export interface RunTurnConfig {
  /** N — candidates requested per generation attempt. 1 in the walking
   * skeleton (ADR §1.5); the loop already ranks 1..N uniformly. */
  candidatesPerAttempt: number;
  /** Bounded regenerate-on-RED retries (epic AC: "regenerate (bounded)"). */
  maxAttempts: number;
  /** The all-English message emitted when every attempt still has a RED
   * token — the terminal repair of the never-show-wrong law. */
  englishFallbackText: string;
}

export const DEFAULT_RUN_TURN_CONFIG: RunTurnConfig = {
  candidatesPerAttempt: 1,
  maxAttempts: 3,
  englishFallbackText:
    "Sorry, I couldn't verify that safely — let's try a different way.",
};

export interface RunTurnResult {
  message: TutorMessage;
  /** `undefined` only on the fallback path (nothing was verified). */
  ttsPayload: TtsPayload | undefined;
  /** How many generation attempts ran (1 = succeeded on the first try). */
  attempts: number;
  /** `true` only when every attempt exhausted with a RED token still
   * present — the terminal English-fallback repair fired. */
  fellBackToEnglish: boolean;
}

interface GatedCandidate {
  candidate: GeneratedCandidate;
  tokens: VerifiedToken[];
  score: number;
}

function floorScore(floors: CoverageFloor[], tokens: VerifiedToken[], snapshot: UserSnapshot): number {
  const spines = tokens.map((t) => t.spine);
  return floors.filter((floor) => floor.satisfied(spines, snapshot)).length;
}

function hasRed(tokens: VerifiedToken[]): boolean {
  return tokens.some((t) => t.band === "RED");
}

/** Rank N gated candidates: declared-floor count first (higher is better),
 * then the pack's optional `scoreCandidate` term, then original order —
 * deterministic on ties (ADR §1.5's cheap-rank step). */
function pickWinner(
  ports: AppPorts,
  gated: GatedCandidate[],
  snapshot: UserSnapshot,
): GatedCandidate {
  const scored = gated.map((g, i) => {
    const packScore = ports.steeringPolicy.scoreCandidate?.(g.candidate, snapshot) ?? 0;
    return { g, i, key: g.score * 1_000_000 + packScore };
  });
  scored.sort((a, b) => b.key - a.key || a.i - b.i);
  const first = scored[0];
  if (!first) {
    throw new Error("turn loop: pickWinner called with zero candidates");
  }
  return first.g;
}

async function attemptOnce(
  ports: AppPorts,
  generator: CandidateGenerator,
  learnerMessage: string,
  plan: TurnPlan,
  turnCtx: TurnContext,
  snapshot: UserSnapshot,
  n: number,
): Promise<GatedCandidate | undefined> {
  const constraints = ports.steeringPolicy.generationConstraints(plan);
  const candidates = await generator.generate({
    learnerMessage,
    plan,
    constraints,
    n,
  });
  if (candidates.length === 0) return undefined;

  const gated: GatedCandidate[] = [];
  for (const candidate of candidates) {
    const tokens = await ports.verificationGate.verify(
      { targetText: candidate.text, intents: plan.intents },
      turnCtx,
    );
    gated.push({
      candidate,
      tokens,
      score: floorScore(ports.curriculumPolicy.floors, tokens, snapshot),
    });
  }
  return pickWinner(ports, gated, snapshot);
}

/**
 * The turn loop proper. Generates up to `config.maxAttempts` times; each
 * attempt gates every candidate BEFORE any ranking decision is finalized
 * (text-in/tokens-out, ADR §1.3 port 1). The winning candidate is accepted
 * only when its gated stream carries zero RED tokens — otherwise the loop
 * regenerates. On exhaustion, falls back to English (never renders an
 * unverified byte).
 */
export async function runTurn(
  ports: AppPorts,
  generator: CandidateGenerator,
  input: RunTurnInput,
  config: RunTurnConfig = DEFAULT_RUN_TURN_CONFIG,
): Promise<RunTurnResult> {
  const plan: TurnPlan = { intents: input.intents };
  const turnCtx: TurnContext = { turnId: input.messageId };

  let attempts = 0;
  let lastGreenWinner: GatedCandidate | undefined;

  while (attempts < config.maxAttempts) {
    attempts += 1;
    const winner = await attemptOnce(
      ports,
      generator,
      input.learnerMessage,
      plan,
      turnCtx,
      input.snapshot,
      config.candidatesPerAttempt,
    );
    if (winner === undefined) continue; // no candidates this attempt — retry
    if (!hasRed(winner.tokens)) {
      lastGreenWinner = winner;
      break;
    }
    // RED present: never render it — discard this attempt and regenerate.
  }

  if (lastGreenWinner === undefined) {
    return {
      message: buildEnglishFallbackMessage({
        messageId: input.messageId,
        targetLang: input.targetLang,
        text: config.englishFallbackText,
      }),
      ttsPayload: undefined,
      attempts,
      fellBackToEnglish: true,
    };
  }

  const verified = lastGreenWinner.tokens;
  const emptyStates: UnitStateMap = new Map();
  const directives: ScaffoldDirective[] = verified.map((token) => {
    const units = ports.masteryModel.unitsForToken(token.spine, token.annotations);
    return ports.masteryModel.scaffoldPlan(
      { spine: token.spine, annotations: token.annotations, units },
      emptyStates,
    );
  });
  const blended = ports.steeringPolicy.anglicizeDown(verified, directives);
  const directivesByTokenId = new Map(
    verified.map((token, i) => [token.spine.id, directives[i] as ScaffoldDirective] as const),
  );
  const message = buildTutorMessage({
    messageId: input.messageId,
    targetLang: input.targetLang,
    annotationCodec: ports.annotationCodec,
    blended,
    guard: attempts > 1 ? "regenerated:red-repair" : "passed",
    directivesByTokenId,
  });
  const ttsPayload = await ports.ttsDriver.synthesize(verified, input.voice);

  return { message, ttsPayload, attempts, fellBackToEnglish: false };
}
