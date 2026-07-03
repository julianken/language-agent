/**
 * Playwright e2e for the walking-skeleton renderer (issue #10). Serves the
 * BUILT site (`vite build` → dist-site) from the server itself — single
 * origin, so the SSE stream, the learning-event POST, and the static app
 * all exercise the real `@la/server` HTTP surface.
 *
 * The server also boots real-turn mode (LANGUAGE=fake — no sidecar/docker
 * needed: the fake pack's gate is deterministic and fully in-process; #10's
 * real-#9-integration follow-up) ALONGSIDE fixture mode, so `real-turn.spec.ts`
 * can `POST /api/turns` and render the response through `?turn=<id>` on the
 * exact same server `renderer.spec.ts` uses for `?fixture=<id>`. The `ar`
 * leg's real-sidecar proof runs server-side instead (`@la/server`'s
 * `test:e2e-sse` in CI's `conformance (ar)` job, which already boots the ar
 * sidecar) — booting Docker in this browser-e2e job isn't warranted just to
 * re-prove the same transport code path against a second pack.
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
      // Real-turn mode — the fake leg only (docker-free; see file header).
      LANGUAGE: "fake",
      SIDECAR_BASE_URL: "http://127.0.0.1:0",
      SIDECAR_MODE: "mock",
      ASSETS_ROOT: "../../packages/lang-fake/assets",
      TTS_PROVIDER: "test",
      TTS_VOICE: "v1",
      REPLAY_FIXTURES_DIR: "../server/fixtures/llm-replay/fake",
    },
  },
});
