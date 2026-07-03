/**
 * @la/server — the composition root app (ADR §2). The ONLY package
 * permitted to import `@la/lang-*` packages (ADR §2.4 rule a), via the
 * literal-import registry in `composeApp.ts`. The fixture-mode HTTP/SSE
 * transport (anti-buffering SSE endpoint + the shared learning-event
 * route) landed with #10 under `./http`; the hot-path turn loop that
 * replaces the fixture token source is exclusively owned by #9 (ADR §5.2).
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
