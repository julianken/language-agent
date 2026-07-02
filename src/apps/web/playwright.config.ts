/**
 * Playwright e2e for the walking-skeleton renderer (issue #10). Serves the
 * BUILT site (`vite build` → dist-site) from the fixture server itself —
 * single origin, so the SSE stream, the learning-event POST, and the static
 * app all exercise the real `@la/server` HTTP surface.
 *
 * Prereq: `pnpm -w run build` (tsc dists) + `pnpm run build:site`. The
 * `e2e` package script chains all three.
 *
 * Chromium project only, mirroring the spike's caveat honestly: the spike
 * verified Chromium/WebKit/Firefox; Playwright-WebKit ≠ real Safari either
 * way, and a manual Safari pass stays on the follow-up list
 * (docs/research/rtl-rendering-spike.md → "Limitation").
 */

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  forbidOnly: !!process.env["CI"],
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:8787",
  },
  webServer: {
    command: "node ../server/dist/http/main.js",
    url: "http://127.0.0.1:8787/api/health",
    reuseExistingServer: !process.env["CI"],
    env: {
      PORT: "8787",
      HOST: "127.0.0.1",
      FIXTURES_DIR: "../server/fixtures",
      WEB_DIST: "./dist-site",
    },
  },
});
