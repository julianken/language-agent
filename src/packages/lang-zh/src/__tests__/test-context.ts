/**
 * Test-only `PackContext` for exercising the real zh pack's TCK. Points at
 * a REAL RUNNING `src/sidecars/zh` instance — the pack's
 * `verificationGate` gates every golden case through the actual
 * deterministic-legs-v0 gate (never a mock, per issue #8's mock-exclusion
 * precedent extended to this suite, mirrors `@la/lang-ar`'s test-context.ts).
 *
 * `SIDECAR_ZH_BASE_URL` mirrors `SIDECAR_AR_BASE_URL`'s convention; the
 * default port 8137 matches `compose.yaml`'s `sidecar-zh` service mapping
 * for local runs. CI's `conformance` job (zh leg) boots the CI-built image
 * directly and sets this env var — see `.github/workflows/ci.yml`.
 */

import type { PackContext } from "@la/contract";

const DEFAULT_BASE_URL = "http://127.0.0.1:8137";

export function makeTestContext(): PackContext {
  const baseUrl = process.env["SIDECAR_ZH_BASE_URL"] ?? DEFAULT_BASE_URL;
  return {
    sidecar: { baseUrl },
    assets: {
      read(assetId) {
        return Promise.reject(
          new Error(`zh TCK test context: asset '${assetId}' is not needed by the conformance suite`),
        );
      },
    },
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    config: {},
    fsrs: {},
  };
}

export const TURN = { turnId: "tck-turn" };
