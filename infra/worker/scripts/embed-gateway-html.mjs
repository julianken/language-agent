#!/usr/bin/env node
/**
 * Regenerates `infra/worker/gateway-html.generated.js` from
 * `src/apps/router/index.html` (Group A — the self-contained gateway page,
 * already built; DO NOT hand-edit that file from here).
 *
 * language-router-gateway plan, Task 7, R-A: the Worker embeds the
 * gateway as ONE self-contained HTML string (inlined CSS + data-URI
 * fonts) rather than a Workers Static Assets binding — `env.ASSETS`
 * needs Cloudflare provider v5, a breaking Terraform migration this plan
 * deliberately avoids (see the plan's R-A). `JSON.stringify` (not a
 * hand-written template literal) sidesteps any need to reason about
 * backticks/`${}`/backslashes inside the embedded HTML — correct
 * regardless of what the source file happens to contain.
 *
 * Run: `node infra/worker/scripts/embed-gateway-html.mjs` (from the repo
 * root, or anywhere — paths below are resolved from this script's own
 * location, not the cwd). Re-run whenever Group A's index.html changes.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, "..", "..", "..", "src", "apps", "router", "index.html");
const outPath = join(here, "..", "gateway-html.generated.js");

const html = readFileSync(sourcePath, "utf8");

const banner =
  "// GENERATED — do not hand-edit. Regenerate with:\n" +
  "//   node infra/worker/scripts/embed-gateway-html.mjs\n" +
  "// Source of truth: src/apps/router/index.html (Group A, the\n" +
  "// self-contained gateway page).\n\n";

writeFileSync(outPath, `${banner}export const GATEWAY_HTML = ${JSON.stringify(html)};\n`);

console.log(`wrote ${outPath} (${html.length} bytes embedded)`);
