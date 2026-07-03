/**
 * The per-model request-parameter branch (epic Research summary; AC: "the
 * API wrapper must branch params per model since the two models take
 * incompatible parameter shapes"). Verified against the live Anthropic API
 * docs at implementation time — see the PR body's step-10 citation (epic
 * Open Question #3).
 *
 * `claude-sonnet-5`: adaptive thinking only — `thinking: {type:"enabled",
 * budget_tokens:N}` is REMOVED on this model family and returns a 400; this
 * wrapper never emits a `budget_tokens` key. `claude-haiku-4-5` (used for
 * guard calls, if any land on this loop): the `effort` parameter errors on
 * Haiku 4.5 — this wrapper never emits an `effort` key for it.
 */

export const SONNET_MODEL = "claude-sonnet-5";
export const HAIKU_MODEL = "claude-haiku-4-5";

export interface ModelBranchedParams {
  thinking?: { type: "adaptive" };
  effort?: "low" | "medium" | "high" | "max";
}

/**
 * Returns exactly the model-dependent slice of the request params — spread
 * this into the base request object. Throws for any model outside the two
 * this hot path uses (fail loud, never silently send an unbranched shape).
 */
export function modelParamsFor(model: string): ModelBranchedParams {
  if (model === SONNET_MODEL) {
    // Adaptive thinking; no budget_tokens (removed on this model); effort
    // is left to the caller's default (omitted here — the API defaults to
    // "high").
    return { thinking: { type: "adaptive" } };
  }
  if (model === HAIKU_MODEL) {
    // No thinking, no effort — sending `effort` to Haiku 4.5 errors.
    return {};
  }
  throw new Error(
    `modelParamsFor: unsupported model '${model}' — this hot path only branches ` +
      `${SONNET_MODEL} (generation) and ${HAIKU_MODEL} (guard calls)`,
  );
}
