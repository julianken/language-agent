/**
 * The narrow `PackContext` — what each pack FACTORY receives (ADR §1.2).
 *
 * Never the engine, never another seam's objects (Fastify-encapsulation /
 * anti-god-context). The composition root (`composeApp`, ADR §2.3) builds
 * exactly one per boot via `makePackContext` and hands it to the five
 * factory ports; the four data ports (`annotationCodec`,
 * `rendererManifest`, `sidecarDescriptor`, `assetManifest`) are plain
 * values and never see it.
 */

import type { AssetId } from "./assets.js";

/**
 * The typed sidecar HTTP client, bound to the pack's declared image.
 *
 * v0-minimal surface: the CONCRETE generated client (openapi-fetch over the
 * hand-authored shared OpenAPI document) is exclusively owned by #7's
 * spec-first PR (ADR §3.2, §5.2); it will satisfy/extend this shape inside
 * the v0.x churn window. `@la/lang-fake` runs sidecar-less and never calls
 * it.
 */
export interface SidecarClient {
  readonly baseUrl: string;
}

/**
 * Asset reader SCOPED to the pack's own `assetManifest` (ADR §1.2): only
 * declared `AssetId`s resolve; the returned content has already been
 * validated against the asset's declared `spineSchema`.
 */
export interface AssetReader {
  read(assetId: AssetId): Promise<unknown>;
}

/** Minimal structured logger handed to pack factories. */
export interface PackLogger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

/**
 * The engine's shared FSRS library, which packs MAY call (ADR §1.4 —
 * "a shared FSRS library packs may call via PackContext").
 *
 * Deliberately EMPTY at v0: the concrete FSRS implementation is
 * engine-owned and lands with real mastery wiring (post-skeleton — the
 * walking skeleton binds FixedRatioScaffold, ADR §5.2 #9). Widening this
 * surface is a contract-version change made when its first pack consumer
 * exists (the two-implementation rule, ADR §6).
 */
export interface FsrsLibrary {}

export interface PackContext {
  sidecar: SidecarClient;
  assets: AssetReader;
  logger: PackLogger;
  /** The pack's validated config slice (never the whole instance config). */
  config: unknown;
  fsrs: FsrsLibrary;
}
