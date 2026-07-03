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
 *     through the pack's REAL gate. This file stays language-blind: it
 *     only forwards `LANGUAGE` to the generic `parseInstanceConfig` /
 *     `composeApp` — it never branches on the value (ADR §2.4 mechanism 4;
 *     `composeApp.ts` is the sole sanctioned exception, not this file).
 *
 *   PORT                listen port (default 8787)
 *   HOST                bind address (default 127.0.0.1)
 *   FIXTURES_DIR        fixture documents (default <package>/fixtures)
 *   WEB_DIST            built web app to serve statically (optional)
 *   LANGUAGE            fake|ar|zh — when set, boots real-turn mode
 *   SIDECAR_BASE_URL    the pack's sidecar base URL (real mode)
 *   SIDECAR_MODE        real|fixture|mock (default "real")
 *   ASSETS_ROOT         the pack's asset root (real mode; required then)
 *   TTS_PROVIDER        default voice provider (real mode; default "test")
 *   TTS_VOICE           default voice id (real mode; default "v1")
 *   REPLAY_FIXTURES_DIR the ReplayCandidateGenerator's corpus dir (real
 *                       mode; required then — e.g. `fixtures/llm-replay/ar`)
 */

import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { composeApp } from "../composeApp.js";
import { parseInstanceConfig } from "../config.js";
import { ReplayCandidateGenerator } from "../llm/replay-client.js";
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
  const generator = new ReplayCandidateGenerator({
    fixturesDir: resolve(process.env["REPLAY_FIXTURES_DIR"] ?? ""),
  });
  return { app, generator };
}

async function main(): Promise<void> {
  const language = process.env["LANGUAGE"];
  const realTurn = language ? await buildRealTurnOptions(language) : undefined;

  const { server } = createFixtureServer({ fixturesDir, webDist, realTurn });

  server.listen(port, host, () => {
    console.info(
      `server on http://${host}:${port} (fixtures: ${fixturesDir}` +
        `${webDist ? `, web: ${webDist}` : ""}` +
        `${language ? `, real-turn language: ${language}` : ""})`,
    );
  });
}

main().catch((err: unknown) => {
  console.error("boot failure", err);
  process.exit(1);
});
