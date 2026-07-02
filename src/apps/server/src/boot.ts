/**
 * Boot validation + PackContext assembly (ADR §2.3). Every failure here is
 * a BOOT failure with a named-seam error — never a runtime undefined three
 * layers into the gate.
 */

import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type {
  AssetManifest,
  AssetReader,
  LanguagePack,
  PackContext,
  PackLogger,
  SidecarClient,
} from "@la/contract";
import { CONTRACT_VERSION } from "@la/contract";
import type { InstanceConfig } from "./config.js";

/**
 * The boot equality assert (ADR §2.3): exact equality, never a semver
 * range — all packs are in-tree, `workspace:*`-pinned, deployed lockstep.
 */
export function assertContractVersionEqual(pack: LanguagePack): void {
  if (pack.meta.contractVersion !== CONTRACT_VERSION) {
    throw new Error(
      `boot failure [meta]: pack '${pack.meta.lang}' declares contractVersion ` +
        `${pack.meta.contractVersion}, engine requires exactly ${CONTRACT_VERSION} ` +
        "(in-tree packs migrate in the same PR as a contract bump)",
    );
  }
}

/**
 * Asset boot validation (ADR §1.3 port 9, §2.3): every named asset EXISTS
 * under the instance's assetsRoot and its parsed content validates against
 * the declared spine schema. Existence + spine-schema validity ONLY — no
 * checksums (git+Docker already guarantee content integrity; ADR §6).
 */
export async function assertAssetsPresent(
  manifest: AssetManifest,
  assetsRoot: string,
): Promise<void> {
  for (const [assetId, decl] of Object.entries(manifest.assets)) {
    const fullPath = join(assetsRoot, decl.path);
    try {
      await stat(fullPath);
    } catch {
      throw new Error(
        `boot failure [assetManifest]: asset '${assetId}' missing at ${fullPath}`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(fullPath, "utf8"));
    } catch (cause) {
      throw new Error(
        `boot failure [assetManifest]: asset '${assetId}' at ${fullPath} is not valid JSON`,
        { cause },
      );
    }
    const result = decl.spineSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `boot failure [assetManifest]: asset '${assetId}' fails its declared ` +
          `spine schema: ${result.error.message}`,
      );
    }
  }
}

/**
 * The scoped asset reader handed to pack factories (ADR §1.2): only ids
 * declared in the pack's own manifest resolve; content is validated
 * against the declared spine schema on every read.
 */
export function makeAssetReader(
  manifest: AssetManifest,
  assetsRoot: string,
): AssetReader {
  return {
    async read(assetId) {
      const decl = manifest.assets[assetId];
      if (!decl) {
        throw new Error(
          `asset reader: '${assetId}' is not declared in this pack's assetManifest`,
        );
      }
      const parsed: unknown = JSON.parse(
        await readFile(join(assetsRoot, decl.path), "utf8"),
      );
      return decl.spineSchema.parse(parsed);
    },
  };
}

const consoleLogger: PackLogger = {
  debug: (msg, fields) => console.debug(msg, fields ?? ""),
  info: (msg, fields) => console.info(msg, fields ?? ""),
  warn: (msg, fields) => console.warn(msg, fields ?? ""),
  error: (msg, fields) => console.error(msg, fields ?? ""),
};

/**
 * The typed sidecar client, bound to the configured base URL. v0-minimal:
 * the GENERATED client (openapi-fetch over the shared OpenAPI document)
 * and the live `assertSidecarAgrees` capabilities cross-check are owned by
 * #7's spec-first PR (ADR §3.2, §5.2).
 */
export function createSidecarClient(baseUrl: string): SidecarClient {
  return { baseUrl };
}

/**
 * Assemble the narrow PackContext (ADR §1.2/§2.3): the typed sidecar
 * client, the scoped asset reader, a logger, the pack's validated config
 * slice, and the shared FSRS library — never the engine, never another
 * seam's objects. The FSRS surface is deliberately empty at v0 (the
 * walking skeleton binds FixedRatioScaffold; ADR §5.2 #9).
 */
export function makePackContext(
  pack: LanguagePack,
  config: InstanceConfig,
  logger: PackLogger = consoleLogger,
): PackContext {
  return {
    sidecar: createSidecarClient(config.sidecar.baseUrl),
    assets: makeAssetReader(pack.assetManifest, config.assetsRoot),
    logger,
    // v0: no pack-specific config slice is defined yet; the slice narrows
    // (per-pack zod schema) when the first pack config lands.
    config: {},
    fsrs: {},
  };
}
