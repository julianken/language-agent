/**
 * The composition root (ADR §2.1, §2.3): `composeApp(config)` — a
 * hand-rolled, PURE function; constructor/factory injection; no container,
 * no decorators (the documented escape hatch, if this ever becomes
 * unreadable, is a mechanical migration to Awilix strict-mode — never to
 * decorators). A pure composition function is the drop-in test's unit: CI
 * calls `composeApp(fakeConfig)` / `composeApp(arConfig)` /
 * `composeApp(zhConfig)` and runs the identical suite.
 *
 * This file is the ONLY place in the codebase that names languages — the
 * sanctioned exception to the no-`lang===` gate (eslint.config.mjs
 * COMPOSITION_ROOT_FILE + scripts/check-no-lang-conditional.sh).
 */

import type {
  AnnotationCodec,
  AssetManifest,
  CurriculumPolicy,
  DerivedCapabilities,
  LanguageId,
  LanguagePack,
  LanguagePackMeta,
  MasteryModel,
  RendererManifest,
  SidecarDescriptor,
  SteeringPolicy,
  TtsDriver,
  VerificationGate,
  PackContext,
} from "@la/contract";
import { PackManifestSchema, deriveCapabilities } from "@la/contract";
import type { InstanceConfig } from "./config.js";
import {
  assertAssetsPresent,
  assertContractVersionEqual,
  makePackContext,
} from "./boot.js";

/**
 * The literal-import registry — literal specifiers, never
 * `import(config.modulePath)`: computed specifiers are untyped, defeat
 * tree-shaking, and fail at runtime instead of compile time. The
 * exhaustive `Record<LanguageId, …>` makes adding language N a
 * compiler-checked one-line edit (ADR §2.3).
 *
 * `zh` is a STUB entry within this epic: it flips to a real literal
 * `import('@la/lang-zh')` in a one-line, compiler-checked registry edit in
 * #21 (the flip that closes the v0.x churn window; dual-instance amendment,
 * Decision 2). `ar` flipped to its real literal import in #9.
 */
const registry: Record<LanguageId, () => Promise<{ pack: LanguagePack }>> = {
  fake: () => import("@la/lang-fake"),
  ar: () => import("@la/lang-ar"),
  zh: () => {
    throw new Error(
      "boot failure [registry]: '@la/lang-zh' is not wired yet — the real " +
        "literal import lands in #21 (one compiler-checked registry line)",
    );
  },
};

/** The instantiated ports the engine wires against (all nine seams). */
export interface AppPorts {
  verificationGate: VerificationGate;
  steeringPolicy: SteeringPolicy;
  annotationCodec: AnnotationCodec;
  masteryModel: MasteryModel;
  curriculumPolicy: CurriculumPolicy;
  rendererManifest: RendererManifest;
  ttsDriver: TtsDriver;
  sidecarDescriptor: SidecarDescriptor;
  assetManifest: AssetManifest;
}

/**
 * The composed app. v0: the validated pack, its derived capabilities, and
 * the nine instantiated ports — the surface #9's turn loop wires the
 * engine services onto (that loop is exclusively #9's; ADR §5.2).
 */
export interface App {
  lang: LanguageId;
  meta: LanguagePackMeta;
  capabilities: DerivedCapabilities;
  ports: AppPorts;
}

/**
 * Plain constructor/factory calls — the five factory seams get the ONE
 * narrow PackContext; the four data seams pass through (ADR §1.2).
 */
function wireEngine(pack: LanguagePack, ctx: PackContext): AppPorts {
  return {
    verificationGate: pack.verificationGate(ctx),
    steeringPolicy: pack.steeringPolicy(ctx),
    annotationCodec: pack.annotationCodec,
    masteryModel: pack.masteryModel.make(ctx),
    curriculumPolicy: pack.curriculumPolicy.make(ctx),
    rendererManifest: pack.rendererManifest,
    ttsDriver: pack.ttsDriver(ctx),
    sidecarDescriptor: pack.sidecarDescriptor,
    assetManifest: pack.assetManifest,
  };
}

export async function composeApp(config: InstanceConfig): Promise<App> {
  const { pack } = await registry[config.language](); // literal specifiers — typed, lazy, tree-shakeable
  assertContractVersionEqual(pack); // exact equality; in-tree lockstep needs no ranges
  PackManifestSchema.parse(pack); // manifest shape (named-seam boot errors)
  const caps = deriveCapabilities(pack); // pure function over the ports (ADR §2.2)
  await assertAssetsPresent(pack.assetManifest, config.assetsRoot); // every named asset exists + spine-schema-valid
  // assertSidecarAgrees(sidecar, caps) — the live GET /v1/capabilities
  // cross-check — lands with #7's spec-first PR (the generated client).
  const ctx = makePackContext(pack, config);
  return {
    lang: pack.meta.lang,
    meta: pack.meta,
    capabilities: caps,
    ports: wireEngine(pack, ctx),
  };
}
