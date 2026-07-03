import { fileURLToPath } from "node:url";

/**
 * Absolute path to this package's committed `assets/` directory — the
 * `assetsRoot` an instance config points at when booting the ar pack
 * (mirrors `@la/lang-fake`'s `FAKE_ASSETS_ROOT`,
 * `src/packages/lang-fake/src/assets-root.ts`). Works from both `src/`
 * (typecheck/tests) and `dist/` (built) since `src/assets/` and
 * `dist/assets/` are each two levels below their package root, a sibling
 * of the committed `assets/` directory.
 */
export const AR_ASSETS_ROOT = fileURLToPath(
  new URL("../../assets/", import.meta.url),
);
