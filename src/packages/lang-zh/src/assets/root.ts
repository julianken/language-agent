import { fileURLToPath } from "node:url";

/**
 * Absolute path to this package's committed `assets/` directory — the
 * `assetsRoot` an instance config points at when booting the zh pack
 * (mirrors `@la/lang-ar`'s `AR_ASSETS_ROOT`). Works from both `src/`
 * (typecheck/tests) and `dist/` (built) since `src/assets/` and
 * `dist/assets/` are each two levels below their package root, a sibling
 * of the committed `assets/` directory.
 */
export const ZH_ASSETS_ROOT = fileURLToPath(
  new URL("../../assets/", import.meta.url),
);
