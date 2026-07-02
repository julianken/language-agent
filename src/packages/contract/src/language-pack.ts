/**
 * The `LanguagePack` manifest object (ADR §1.2) — a plain, fully-typed
 * manifest (ESLint-flat-config shape, not a class hierarchy): `meta` + the
 * nine ports, one per delta seam.
 *
 * There is deliberately NO declared `capabilities` block: direction, unit
 * kinds, fade dimensions, gating/credit-leak edges, floor ids, and the
 * sidecar image are all already carried by the ports. Capabilities are
 * DERIVED (`deriveCapabilities`, ADR §2.2) — a second declaration of the
 * same facts inside one package is a drift surface with no consumer the
 * ports don't serve. The manifest schema REJECTS unknown keys, so a
 * `capabilities` field fails validation mechanically.
 *
 * Five fields are FACTORIES receiving the narrow `PackContext` (seams
 * 1, 2, 4, 5, 7); four are plain data (seams 3, 6, 8, 9). Seams 4 and 5
 * use object-shaped factories because they carry declaration halves that
 * `deriveCapabilities` reads pre-instantiation; seams 1, 2 and 7 are plain
 * `(ctx) => port` functions.
 */

import type { LanguageId } from "./spine.js";
import type { MasteryModelFactory } from "./mastery.js";
import type {
  AnnotationCodec,
  CurriculumPolicyFactory,
  RendererManifest,
  SidecarDescriptor,
  SteeringPolicyFactory,
  TtsDriverFactory,
  VerificationGateFactory,
} from "./ports.js";
import type { AssetManifest } from "./assets.js";

export interface LanguagePackMeta {
  lang: LanguageId;
  packageVersion: string;
  /** Must EQUAL the engine's `CONTRACT_VERSION`; asserted at boot
   * (exact equality — in-tree lockstep needs no ranges; ADR §1.2). */
  contractVersion: string;
}

export interface LanguagePack<TAnn = unknown> {
  meta: LanguagePackMeta;
  // — the nine ports, one per delta seam (ADR §1.2/§1.3) —
  /** seam 1 */
  verificationGate: VerificationGateFactory<TAnn>;
  /** seam 2 */
  steeringPolicy: SteeringPolicyFactory<TAnn>;
  /** seam 3 */
  annotationCodec: AnnotationCodec<TAnn>;
  /** seam 4 */
  masteryModel: MasteryModelFactory;
  /** seam 5 */
  curriculumPolicy: CurriculumPolicyFactory;
  /** seam 6 (keys; components ship at /react subpath) */
  rendererManifest: RendererManifest;
  /** seam 7 */
  ttsDriver: TtsDriverFactory;
  /** seam 8 (image ref + expected capabilities) */
  sidecarDescriptor: SidecarDescriptor;
  /** seam 9 (named assets + spine schema) */
  assetManifest: AssetManifest;
}
