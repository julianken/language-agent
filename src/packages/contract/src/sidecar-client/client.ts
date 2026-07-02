/**
 * The concrete typed sidecar client — `openapi-fetch` over the
 * hand-authored shared OpenAPI document (ADR §3.2; exclusively owned by
 * #7's spec-first PR per §5.2).
 *
 * `GeneratedSidecarClient` structurally satisfies/extends the v0-minimal
 * `SidecarClient` shape in `pack-context.ts` (`{ readonly baseUrl }`)
 * inside the v0.x churn window — the engine's composition root
 * (`createSidecarClient` in ADR §2.3) binds it; packs only ever receive it
 * through their narrow `PackContext`.
 */

import createClient, { type Client } from "openapi-fetch";
import type { paths } from "./openapi-types.gen.js";

/** The shared OpenAPI document's path/operation surface. */
export type SidecarPaths = paths;

export interface GeneratedSidecarClient {
  /** The sidecar base URL this client is bound to. */
  readonly baseUrl: string;
  /**
   * The typed `openapi-fetch` client: `http.GET("/readyz")`,
   * `http.POST("/v1/verify", { body })`, … — every path, body, and
   * response typed from the generated `paths`.
   */
  readonly http: Client<paths>;
}

export function createSidecarClient(baseUrl: string): GeneratedSidecarClient {
  return { baseUrl, http: createClient<paths>({ baseUrl }) };
}
