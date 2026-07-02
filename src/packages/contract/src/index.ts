/**
 * @la/contract — the drop-in language-pack contract, v0.
 *
 * Standalone and semver'd, with ZERO runtime dependencies on the engine or
 * any other workspace package (zod is the one external runtime dep —
 * schema identity is load-bearing, ADR §5.1): pure TS types, zod schemas,
 * and the manifest schema. Engine, language packs, and the TCK all depend
 * on it; nothing depends on the engine (ADR §1.1).
 *
 * The nine ports, one per committed-spec delta seam (ADR §1.3):
 *   1 VerificationGate   2 SteeringPolicy    3 AnnotationCodec
 *   4 MasteryModel       5 CurriculumPolicy  6 RendererManifest
 *   7 TtsDriver          8 SidecarDescriptor 9 AssetManifest
 *
 * (The hand-authored sidecar OpenAPI document and its codegen pipelines are
 * exclusively owned by #7's spec-first PR — ADR §3.2, §5.2.)
 */

export * from "./version.js";
export * from "./spine.js";
export * from "./scaffold.js";
export * from "./assets.js";
export * from "./pack-context.js";
export * from "./mastery.js";
export * from "./ports.js";
export * from "./language-pack.js";
export * from "./manifest-schema.js";
export * from "./derive-capabilities.js";
