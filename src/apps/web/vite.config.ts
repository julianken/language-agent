/**
 * Vite config for the site build. `dist-site/` (not `dist/`) on purpose:
 * `dist/` is the tsc library output the package `exports` map points at.
 * The /api proxy targets the fixture server (`@la/server`'s
 * `serve:fixtures`) for local dev; e2e serves the built site from the
 * fixture server itself (single origin), so no proxy is involved there.
 *
 * `base: "./"` (relative asset URLs) — language-router-gateway plan, Task
 * 5/R-B: the bundle is built ONCE (no `VITE_BASE`, no per-instance build)
 * and served from whatever path prefix the deploying server mounts it
 * under (`/`, `/ar/`, `/zh/`); the server injects a matching
 * `<base href>` into `index.html` at serve time (Task 6), and the app
 * resolves every `/api/*` call against `document.baseURI` via the
 * `apiUrl()` helper (`src/shell/api-url.ts`) rather than a build-time
 * constant.
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API = "http://127.0.0.1:8787";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { outDir: "dist-site" },
  server: { proxy: { "/api": API } },
  preview: { proxy: { "/api": API } },
});
