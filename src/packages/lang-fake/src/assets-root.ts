import { fileURLToPath } from "node:url";

/**
 * Absolute path to this package's committed `assets/` directory — the
 * `assetsRoot` an instance config points at when booting the fake pack
 * (server integration test, future CI fake leg). Works from both `src/`
 * (typecheck/tests) and `dist/` (built) since they are siblings of
 * `assets/` under the package root.
 */
export const FAKE_ASSETS_ROOT = fileURLToPath(
  new URL("../assets/", import.meta.url),
);
