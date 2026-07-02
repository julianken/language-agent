/**
 * `@la/contract/sidecar-client` — the typed HTTP client for the shared
 * verification-sidecar contract (`sidecar/openapi.yaml`, ADR §3.2).
 *
 * A SUBPATH export on purpose: consumers of the port types alone
 * (`@la/contract`) never pull the `openapi-fetch` runtime; only code that
 * actually talks to a sidecar (the engine's composition root, #9's hot
 * path) imports this entry point.
 */

export { createSidecarClient } from "./client.js";
export type { GeneratedSidecarClient, SidecarPaths } from "./client.js";
export type { paths, components, operations } from "./openapi-types.gen.js";
