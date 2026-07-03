/**
 * Live-generation boot-mode selection (issue #11 PR2 — the live deploy).
 * The deployed server must use the REAL `claude-sonnet-5` generator
 * (`AnthropicCandidateGenerator`) when a live Anthropic credential is
 * present in the environment, and fall back to the deterministic
 * `ReplayCandidateGenerator` otherwise (local dev / e2e / CI — zero live
 * LLM calls, ADR §3.6). A learner POSTing an arbitrary message to the real
 * deploy must get a real generated+verified+anglicized turn, not a replay.
 *
 * LANGUAGE-blind by construction: this function's input has no language
 * field at all — selection depends ONLY on whether an Anthropic credential
 * is present, never on a language-identity conditional (ADR §2.4 mechanism
 * 4; scripts/check-no-lang-conditional.sh scopes this file same as the
 * rest of `src/apps/server/src`).
 *
 * The env value is read OUTSIDE this function and passed in explicitly
 * (config.ts's "env reading happens outside the composition boundary"
 * discipline) — this keeps the selector pure and unit-testable without
 * mutating or depending on real `process.env`, and without this function
 * ever making a live call itself: constructing `AnthropicCandidateGenerator`
 * (and the `Anthropic` client under it) does no network I/O — see
 * `llm/anthropic-client.ts`'s header comment.
 *
 * The never-show-wrong gate is untouched by this selection: every
 * candidate either generator returns, real or replayed, still passes
 * through the pack's REAL verification gate inside `runHotPathTurn` before
 * a single target-language byte reaches a learner — this only changes
 * WHICH `CandidateGenerator` sources those candidates.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { CandidateGenerator } from "@la/engine";
import { AnthropicCandidateGenerator } from "./anthropic-client.js";
import { ReplayCandidateGenerator } from "./replay-client.js";

export interface SelectCandidateGeneratorOptions {
  /** The `ANTHROPIC_API_KEY` env value, or `undefined`/empty when absent.
   * Presence (not the key's validity) is the entire selection signal. */
  anthropicApiKey: string | undefined;
  /** Replay corpus dir for the fallback branch — read lazily by
   * `ReplayCandidateGenerator`, so an unused value on the Anthropic branch
   * is never touched. */
  fixturesDir: string;
}

export function selectCandidateGenerator(
  opts: SelectCandidateGeneratorOptions,
): CandidateGenerator {
  const key = opts.anthropicApiKey?.trim();
  if (key) {
    return new AnthropicCandidateGenerator({ client: new Anthropic({ apiKey: key }) });
  }
  return new ReplayCandidateGenerator({ fixturesDir: opts.fixturesDir });
}
