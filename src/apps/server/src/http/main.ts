/**
 * Server bin (dev/e2e): binds 127.0.0.1 by default — this is the local
 * dev/e2e surface, not the deploy target (#11 owns the Cloud Run
 * deployment, where the platform injects PORT and the bind is 0.0.0.0).
 *
 * Two modes, selected by whether `LANGUAGE` is set — fixture mode
 * (`?fixture=<id>`) works identically in both, unchanged since #10:
 *
 *   - unset (default): fixture-only, exactly #10's original scope.
 *   - set: ALSO boots a real `composeApp`'d `App` + `ReplayCandidateGenerator`
 *     and wires `POST /api/turns` + `GET /api/stream?turn=<id>` (the #10
 *     real-#9-integration follow-up) — a real turn: generation from
 *     agent-authored replay corpora (zero live LLM calls), verification
 *     through the pack's REAL gate. See the `LANGUAGE` entry below for
 *     this file's language-blindness invariant.
 *
 *   PORT                listen port (default 8787)
 *   HOST                bind address (default 127.0.0.1)
 *   FIXTURES_DIR        fixture documents (default <package>/fixtures)
 *   WEB_DIST            built web app to serve statically (optional)
 *   WEB_BASE            runtime base-path (e.g. "/ar/", "/zh/") spliced
 *                       into the served index.html as `<base href>`
 *                       (Task 6, R-B of the language-router-gateway
 *                       plan) — set directly by the deploying
 *                       environment (cloud-run-service module, next to
 *                       ASSETS_ROOT), NOT derived from LANGUAGE here
 *                       (ADR §2.4 mechanism 4 forbids an equality check
 *                       against the language value in this file). Unset
 *                       (every dev/e2e config today, incl. @la/web's
 *                       playwright.config.ts) means root-served, no
 *                       `<base>` injected — unchanged from before this
 *                       existed.
 *   LANGUAGE            fake|ar|zh — when set, boots real-turn mode. This
 *                       file stays language-blind: it only forwards
 *                       LANGUAGE to the generic `parseInstanceConfig` /
 *                       `composeApp` — it never branches on the value
 *                       (ADR §2.4 mechanism 4; `composeApp.ts` is the
 *                       sole sanctioned exception, not this file).
 *   SIDECAR_BASE_URL    the pack's sidecar base URL (real mode)
 *   SIDECAR_MODE        real|fixture|mock (default "real")
 *   ASSETS_ROOT         the pack's asset root (real mode; required then)
 *   TTS_PROVIDER        default voice provider (real mode; default "test")
 *   TTS_VOICE           default voice id (real mode; default "v1")
 *   REPLAY_FIXTURES_DIR the ReplayCandidateGenerator's corpus dir (real
 *                       mode, fallback branch only — e.g.
 *                       `fixtures/llm-replay/ar`)
 *   ANTHROPIC_API_KEY   live-generation boot mode (issue #11 PR2, real mode
 *                       only): when present, `runHotPathTurn` is wired
 *                       against the REAL `AnthropicCandidateGenerator`
 *                       (claude-sonnet-5) instead of the replay/fixture
 *                       generator — see `llm/select-generator.ts`. Never
 *                       exercised by the PR-blocking E2E; absent in
 *                       every local/CI environment on purpose.
 */

import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { composeApp } from "../composeApp.js";
import { parseInstanceConfig } from "../config.js";
import { selectCandidateGenerator } from "../llm/select-generator.js";
import { createFixtureServer, type RealTurnOptions } from "./server.js";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..", ".."); // dist/http → package root

const port = Number(process.env["PORT"] ?? 8787);
const host = process.env["HOST"] ?? "127.0.0.1";
const fixturesDir = resolve(process.env["FIXTURES_DIR"] ?? join(packageRoot, "fixtures"));
const webDist = process.env["WEB_DIST"] ? resolve(process.env["WEB_DIST"]) : undefined;

async function buildRealTurnOptions(language: string): Promise<RealTurnOptions> {
  const config = parseInstanceConfig({
    language,
    sidecar: {
      baseUrl: process.env["SIDECAR_BASE_URL"] ?? "http://127.0.0.1:0",
      mode: process.env["SIDECAR_MODE"] ?? "real",
    },
    assetsRoot: resolve(process.env["ASSETS_ROOT"] ?? ""),
    tts: {
      provider: process.env["TTS_PROVIDER"] ?? "test",
      voice: process.env["TTS_VOICE"] ?? "v1",
    },
  });
  const app = await composeApp(config);
  const generator = selectCandidateGenerator({
    anthropicApiKey: process.env["ANTHROPIC_API_KEY"],
    fixturesDir: resolve(process.env["REPLAY_FIXTURES_DIR"] ?? ""),
  });
  return { app, generator };
}

async function main(): Promise<void> {
  const language = process.env["LANGUAGE"];
  const realTurn = language ? await buildRealTurnOptions(language) : undefined;
  // Runtime base-path (Task 6, R-B): an opaque passthrough, deliberately
  // NOT derived from `language` here — ADR §2.4 mechanism 4 forbids
  // `lang === `/`language === ` conditionals in this file (the boundary:
  // lang-conditional CI gate greps/lints for exactly that). The deploying
  // environment (cloud-run-service module) sets WEB_BASE directly, the
  // same way it already sets ASSETS_ROOT per instance; dev/e2e configs
  // (e.g. @la/web's playwright.config.ts, LANGUAGE=fake) simply don't set
  // it, so webBase stays undefined there — unchanged from before this
  // existed.
  const webBase = process.env["WEB_BASE"];

  const { server } = createFixtureServer({ fixturesDir, webDist, realTurn, webBase });

  server.listen(port, host, () => {
    console.info(
      `server on http://${host}:${port} (fixtures: ${fixturesDir}` +
        `${webDist ? `, web: ${webDist}` : ""}` +
        `${language ? `, real-turn language: ${language}` : ""}` +
        `${webBase ? `, web base: ${webBase}` : ""})`,
    );
  });
}

main().catch((err: unknown) => {
  console.error("boot failure", err);
  process.exit(1);
});
