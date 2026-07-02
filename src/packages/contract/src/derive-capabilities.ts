/**
 * Derived capabilities (ADR §1.2, §2.2): a PURE function over the pack's
 * ports — capabilities are DERIVED, never declared. One source of each
 * fact inside the package; the cross-PROCESS check (engine vs the
 * sidecar's live `/v1/capabilities` — `assertSidecarAgrees`) is preserved
 * at boot and lands with #7, which is the only place two independent
 * sources genuinely exist.
 */

import type { LanguagePack } from "./language-pack.js";
import type { CreditLeakEdge, GatingEdge } from "./mastery.js";
import type { FadeDimId } from "./scaffold.js";
import type { AssetId } from "./assets.js";

export interface DerivedCapabilities {
  direction: "rtl" | "ltr";
  masteryUnitKinds: string[];
  fadeDimensions: FadeDimId[];
  gatingEdges: GatingEdge[];
  /** Parallels `gatingEdges` — the declared cross-dimensional half of the
   * leak law (the universal same-dimensional half is not a capability;
   * it holds for every pack unconditionally). */
  creditLeakEdges: CreditLeakEdge[];
  coverageFloorIds: string[];
  sidecarImage: string;
  requiredDataAssets: AssetId[];
}

export function deriveCapabilities(pack: LanguagePack): DerivedCapabilities {
  const decl = pack.masteryModel.declarations;
  return {
    direction: pack.rendererManifest.direction,
    masteryUnitKinds: decl.unitKinds.map((k) => k.kind),
    fadeDimensions: [...decl.fadeDimensions],
    gatingEdges: [...decl.gatingEdges],
    creditLeakEdges: [...decl.creditLeakEdges],
    coverageFloorIds: pack.curriculumPolicy.floors.map((f) => f.id),
    sidecarImage: pack.sidecarDescriptor.imageRef,
    requiredDataAssets: Object.keys(pack.assetManifest.assets),
  };
}
