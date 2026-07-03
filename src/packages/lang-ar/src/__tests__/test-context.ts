/**
 * Test-only `PackContext` for exercising the real ar pack's TCK. Unlike
 * `@la/lang-fake`'s test context (in-process, dependency-free), this one
 * points at a REAL RUNNING `src/sidecars/ar` instance — the pack's
 * `verificationGate` gates every golden case through the actual
 * `dediac-roundtrip` + `camel-morph` legs (never a mock, per issue #8's
 * mock-exclusion precedent extended to this suite).
 *
 * `SIDECAR_AR_BASE_URL` mirrors `scripts/validate-seed-vocab.mjs`'s
 * convention; the default matches `compose.yaml`'s `sidecar-ar` port
 * mapping (`docker compose --profile sidecar-ar up sidecar-ar`) for local
 * runs. CI's `conformance` job (ar leg) boots the CI-built image directly
 * and sets this env var — see `.github/workflows/ci.yml`.
 */

import type { PackContext } from "@la/contract";

const DEFAULT_BASE_URL = "http://127.0.0.1:8081";

export function makeTestContext(): PackContext {
  const baseUrl = process.env["SIDECAR_AR_BASE_URL"] ?? DEFAULT_BASE_URL;
  return {
    sidecar: { baseUrl },
    assets: {
      read(assetId) {
        return Promise.reject(
          new Error(`ar TCK test context: asset '${assetId}' is not needed by the conformance suite`),
        );
      },
    },
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    config: {},
    fsrs: {},
  };
}

export const TURN = { turnId: "tck-turn" };
