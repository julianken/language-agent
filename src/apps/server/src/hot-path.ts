/**
 * The hot-path turn-loop service (issue #9): learner English message →
 * `@la/engine`'s language-blind `runTurn` (generate → verify → anglicize) →
 * a gate-verified `tutor-message` payload. This is the composition-layer
 * adapter — it calls the pack's `curriculumPolicy.candidates()` to source
 * this turn's target vocabulary (ADR §5.2 #9's curriculum-cascade bypass:
 * "candidates are drawn only from the seed-vocab known-set", verified here,
 * not inside the language-blind engine loop) and hands the result to
 * `@la/engine`'s `runTurn` as the turn's intents.
 *
 * No language-identity conditional here — this file is scoped by
 * `scripts/check-no-lang-conditional.sh` (`src/apps/server/src` minus the
 * composition-root exception, `composeApp.ts`) and stays language-blind:
 * every seam it touches is a contract port, never a pack internal.
 */

import type { App } from "./composeApp.js";
import type { CandidateGenerator, RunTurnResult } from "@la/engine";
import { runTurn } from "@la/engine";

/** Walking-skeleton stand-in for the real cascade's novelty budget (ADR
 * §1.5) — the seed-vocab-bypass curriculum returns the WHOLE known-set with
 * no ranking; this caps how many candidates become turn intents so the
 * generation prompt stays a reasonable size. */
const NOVELTY_BUDGET = 5;

export interface RunHotPathTurnInput {
  learnerMessage: string;
  messageId: string;
  userId: string;
  topic: string;
  voice: { provider: string; voice: string };
}

export async function runHotPathTurn(
  app: App,
  generator: CandidateGenerator,
  input: RunHotPathTurnInput,
): Promise<RunTurnResult> {
  const snapshot = { userId: input.userId };
  // Seam 5, exercised here: sourced ONLY from the pack's seed-vocab
  // known-set (ADR §5.2 #9's bypass) — no FSRS-due ranking, no
  // topic-relevance. `unit.id` is opaque per-pack (never parsed here).
  const candidates = app.ports.curriculumPolicy.candidates(snapshot, input.topic);
  const intents = candidates.slice(0, NOVELTY_BUDGET).map((c) => ({
    id: `${c.unit.kind}:${c.unit.id}`,
    description: `use or express the concept: ${c.unit.id}`,
  }));

  return runTurn(app.ports, generator, {
    learnerMessage: input.learnerMessage,
    messageId: input.messageId,
    targetLang: app.lang,
    snapshot,
    intents,
    voice: input.voice,
  });
}
