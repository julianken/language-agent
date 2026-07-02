/**
 * Test-only PackContext stub for exercising the fake pack standalone.
 * (The production reader — scoped, spine-schema-validating — lives in the
 * composition root; this is the minimal filesystem stand-in.)
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PackContext } from "@la/contract";
import { FAKE_ASSETS_ROOT } from "../assets-root.js";
import { pack } from "../pack.js";

export function makeTestContext(): PackContext {
  return {
    sidecar: { baseUrl: "http://127.0.0.1:0" },
    assets: {
      async read(assetId) {
        const decl = pack.assetManifest.assets[assetId];
        if (!decl) throw new Error(`undeclared asset: ${assetId}`);
        return JSON.parse(
          await readFile(join(FAKE_ASSETS_ROOT, decl.path), "utf8"),
        ) as unknown;
      },
    },
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    config: {},
    fsrs: {},
  };
}

export const TURN = { turnId: "turn-1" };
