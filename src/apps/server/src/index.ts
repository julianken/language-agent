/**
 * @la/server — the composition root app (ADR §2). The ONLY package
 * permitted to import `@la/lang-*` packages (ADR §2.4 rule a), via the
 * literal-import registry in `composeApp.ts`. The hot-path turn loop and
 * the HTTP/SSE surface are exclusively owned by #9 (ADR §5.2).
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
