/**
 * @la/server — the composition root app (ADR §2). The ONLY package
 * permitted to import `@la/lang-*` packages (ADR §2.4 rule a), via the
 * literal-import registry in `composeApp.ts`. The fixture-mode HTTP/SSE
 * transport (anti-buffering SSE endpoint + the shared learning-event
 * route) landed with #10 under `./http`. The real hot-path turn loop
 * (issue #9): `runHotPathTurn` composes `@la/engine`'s language-blind
 * `runTurn` with a `composeApp`'d `App` and an injected `CandidateGenerator`
 * — the real `claude-sonnet-5` client or the deterministic replay/fixture
 * client, both under `./llm`.
 */

export { composeApp } from "./composeApp.js";
export type { App, AppPorts } from "./composeApp.js";
export { InstanceConfigSchema, parseInstanceConfig } from "./config.js";
export type { InstanceConfig } from "./config.js";
export {
  assertAssetsPresent,
  assertContractVersionEqual,
  createSidecarClient,
  makeAssetReader,
  makePackContext,
} from "./boot.js";
export { runHotPathTurn } from "./hot-path.js";
export type { RunHotPathTurnInput } from "./hot-path.js";
export { AnthropicCandidateGenerator } from "./llm/anthropic-client.js";
export type { AnthropicCandidateGeneratorOptions } from "./llm/anthropic-client.js";
export { ReplayCandidateGenerator } from "./llm/replay-client.js";
export type { ReplayCandidateGeneratorOptions } from "./llm/replay-client.js";
export { HAIKU_MODEL, modelParamsFor, SONNET_MODEL } from "./llm/model-params.js";
export type { ModelBranchedParams } from "./llm/model-params.js";
export { selectCandidateGenerator } from "./llm/select-generator.js";
export type { SelectCandidateGeneratorOptions } from "./llm/select-generator.js";
