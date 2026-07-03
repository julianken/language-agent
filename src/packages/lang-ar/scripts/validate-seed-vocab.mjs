#!/usr/bin/env node
/**
 * Issue #8 AC2 — the seed-vocab validation gate.
 *
 * Boots (or reuses) the REAL Arabic verification sidecar and POSTs every
 * curated `assets/seed-vocab.json` row through its actual `POST /v1/verify`
 * endpoint (the same gate #7's sidecar deploys — `dediac-roundtrip` +
 * `camel-morph`, docs/research/arabic-validation.md §6), carrying the
 * row's `gloss` as the turn's intended-sense tuple
 * (`{ id: lexemeId, description: gloss }`). Exits non-zero if ANY entry's
 * verified token stream is not exactly one token banded GREEN.
 *
 * The Prism mock (`docker compose --profile mock`) and a direct
 * camel-tools/library call are explicitly NOT acceptable substitutes here
 * (issue #8 gate comment, AC2's mock-exclusion clause,
 * https://github.com/julianken/language-agent/issues/8#issuecomment-4871057225):
 * the mock would return a canned GREEN for every request regardless of
 * content, silently voiding the whole point of this gate, and a direct
 * library call could silently diverge from the sidecar's own deployed
 * banding logic. This script only ever talks to a running instance of the
 * real `src/sidecars/ar` FastAPI service over HTTP.
 *
 * Usage:
 *   node scripts/validate-seed-vocab.mjs
 *
 * Env:
 *   SIDECAR_AR_BASE_URL   Base URL of an already-running ar sidecar
 *                         (default http://127.0.0.1:8081, matching
 *                         compose.yaml's sidecar-ar port mapping). If it
 *                         does not answer /readyz, this script boots
 *                         `docker compose --profile sidecar-ar up -d
 *                         sidecar-ar` itself and waits for readiness — CI
 *                         instead pre-boots the CI-built image directly
 *                         (docker run) and points this script at it, which
 *                         skips the compose-boot path entirely (see
 *                         .github/workflows/ci.yml's sidecar-ar job).
 *   SIDECAR_AR_SKIP_BOOT  If set (any value), never attempt to boot the
 *                         sidecar — fail fast with a clear message instead
 *                         of silently hanging in an environment with no
 *                         docker.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../../..", import.meta.url)); // src/packages/lang-ar/scripts -> repo root
const ASSET_PATH = fileURLToPath(new URL("../assets/seed-vocab.json", import.meta.url));

const BASE_URL = process.env.SIDECAR_AR_BASE_URL || "http://127.0.0.1:8081";
const READY_TIMEOUT_MS = 120_000;
const READY_POLL_MS = 1_000;

function log(msg) {
  console.log(`[validate-seed-vocab] ${msg}`);
}

async function isReady(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/readyz`);
    if (res.status !== 200) return false;
    const body = await res.json();
    return body.ready === true;
  } catch {
    return false;
  }
}

async function waitForReady(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isReady(baseUrl)) return true;
    await new Promise((r) => setTimeout(r, READY_POLL_MS));
  }
  return false;
}

function bootViaCompose() {
  return new Promise((resolve, reject) => {
    log("sidecar not reachable at " + BASE_URL + " — booting via `docker compose --profile sidecar-ar up -d sidecar-ar`");
    const child = spawn(
      "docker",
      ["compose", "--profile", "sidecar-ar", "up", "-d", "sidecar-ar"],
      { cwd: REPO_ROOT, stdio: "inherit" },
    );
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`docker compose exited ${code}`))));
  });
}

/** Lightweight structural sanity check duplicating the load-bearing
 * invariants of `../src/assets/schema.ts`'s `ArSeedVocabRowSchema` in
 * plain JS — this script deliberately avoids importing the compiled TS
 * package (it must run standalone in the docker-only `sidecar-ar` CI job,
 * which does not build the pnpm workspace). The canonical zod-schema
 * conformance check lives in `../src/__tests__/assets-schema.test.ts`,
 * which runs in the workspace `build`+`test` job. */
function checkStructure(rows) {
  const problems = [];
  const REQUIRED = ["lexemeId", "surface", "diac", "lemma", "gloss", "senseId", "tier"];
  const seenLexemeIds = new Set();
  const seenSenseIds = new Set();
  for (const [i, row] of rows.entries()) {
    for (const field of REQUIRED) {
      if (typeof row[field] !== "string" || row[field].length === 0) {
        problems.push(`row ${i}: missing/empty required field '${field}'`);
      }
    }
    if (row.tier !== "tier-0" && row.tier !== "tier-1") {
      problems.push(`row ${i} (${row.lexemeId}): tier must be 'tier-0' or 'tier-1', got ${JSON.stringify(row.tier)}`);
    }
    if (row.lexemeId) {
      if (seenLexemeIds.has(row.lexemeId)) problems.push(`duplicate lexemeId '${row.lexemeId}'`);
      seenLexemeIds.add(row.lexemeId);
    }
    if (row.senseId) {
      if (seenSenseIds.has(row.senseId)) problems.push(`duplicate senseId '${row.senseId}'`);
      seenSenseIds.add(row.senseId);
    }
  }
  return problems;
}

async function verifyOne(baseUrl, row) {
  const res = await fetch(`${baseUrl}/v1/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      targetText: row.diac,
      intents: [{ id: row.lexemeId, description: row.gloss }],
    }),
  });
  if (res.status !== 200) {
    return { ok: false, reason: `HTTP ${res.status}` };
  }
  const body = await res.json();
  const tokens = body.tokens ?? [];
  if (tokens.length !== 1) {
    return { ok: false, reason: `expected exactly 1 token, got ${tokens.length}`, tokens };
  }
  const [token] = tokens;
  if (token.band !== "GREEN") {
    const morph = (token.evidence || []).find((e) => e.legId === "camel-morph");
    const dediac = (token.evidence || []).find((e) => e.legId === "dediac-roundtrip");
    return {
      ok: false,
      reason: `band=${token.band}`,
      detail: morph?.detail || dediac?.detail || "(no evidence detail)",
    };
  }
  return { ok: true };
}

async function main() {
  const raw = readFileSync(ASSET_PATH, "utf8");
  /** @type {Array<Record<string, string>>} */
  const rows = JSON.parse(raw);

  const structural = checkStructure(rows);
  if (structural.length > 0) {
    console.error("[validate-seed-vocab] structural check FAILED:");
    for (const p of structural) console.error(`  - ${p}`);
    process.exit(1);
  }
  log(`loaded ${rows.length} entries from ${ASSET_PATH} (structural check passed)`);

  let baseUrl = BASE_URL;
  if (!(await isReady(baseUrl))) {
    if (process.env.SIDECAR_AR_SKIP_BOOT) {
      console.error(
        `[validate-seed-vocab] sidecar not ready at ${baseUrl} and SIDECAR_AR_SKIP_BOOT is set — refusing to boot. ` +
          "Start it yourself: docker compose --profile sidecar-ar up sidecar-ar",
      );
      process.exit(1);
    }
    await bootViaCompose();
    const ready = await waitForReady(baseUrl, READY_TIMEOUT_MS);
    if (!ready) {
      console.error(`[validate-seed-vocab] sidecar never became ready at ${baseUrl} within ${READY_TIMEOUT_MS}ms`);
      process.exit(1);
    }
  }
  log(`sidecar ready at ${baseUrl} — validating every entry through POST ${baseUrl}/v1/verify`);

  const failures = [];
  const tierCounts = {};
  for (const row of rows) {
    tierCounts[row.tier] = (tierCounts[row.tier] || 0) + 1;
    const result = await verifyOne(baseUrl, row);
    if (result.ok) {
      log(`GREEN  ${row.lexemeId.padEnd(18)} ${row.diac}`);
    } else {
      log(`FAIL   ${row.lexemeId.padEnd(18)} ${row.diac}  ${result.reason}${result.detail ? ` — ${result.detail}` : ""}`);
      failures.push({ lexemeId: row.lexemeId, diac: row.diac, ...result });
    }
  }

  console.log("");
  console.log(`[validate-seed-vocab] ${rows.length - failures.length}/${rows.length} entries GREEN`);
  console.log(`[validate-seed-vocab] tier split: ${JSON.stringify(tierCounts)}`);

  if (failures.length > 0) {
    console.error(`[validate-seed-vocab] ${failures.length} entr${failures.length === 1 ? "y" : "ies"} did not band GREEN — fix or drop before shipping:`);
    for (const f of failures) {
      console.error(`  - ${f.lexemeId} (${f.diac}): ${f.reason}${f.detail ? ` — ${f.detail}` : ""}`);
    }
    process.exit(1);
  }

  log("all entries GREEN — seed vocab is valid.");
}

main().catch((err) => {
  console.error("[validate-seed-vocab] fatal:", err);
  process.exit(1);
});
