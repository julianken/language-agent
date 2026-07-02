/**
 * The golden-fixture harness (ADR §4.2 row 1): per-language golden corpora,
 * `(targetText + intents in) → (expected token stream + bands + canonical
 * annotation JSON)`. One focused case per file; files are stable-key-order
 * pretty-printed JSON so corpus diffs are auditable; the SAME assertion
 * code (in `describe-language-pack.ts`) runs over every language's corpus.
 *
 * Corpus conventions:
 * - `<goldenDir>/<case-id>.json`, loaded in sorted filename order.
 * - Every corpus MUST contain at least one GREEN case and at least one
 *   RED (refusal) case — a pack cannot certify on happy-path goldens
 *   alone; gate refusal is the contract's core claim (ADR §1.5).
 * - Probe menus are per-language. ar probes (with #7/#9): dediac
 *   round-trip failures, wrong-sense lemma. zh probes (with #19/#21,
 *   per the dual-instance amendment Decision 3): sandhi surface-vs-
 *   citation disagreement and post-normalization segmenter-boundary
 *   disagreement — exactly two categories.
 *
 * **zh probe set — `spanGroup` intentionally absent (Decision 3 / #20 C6):**
 * discontinuous span-group probes are deliberately NOT part of the zh v0
 * corpus. Curation constraint C6 of the Chinese seed sliver (#20) excludes
 * 離合詞 (discontinuous separable verbs) from the v0 sliver entirely, so a
 * real-leg `spanGroup` probe would be vacuous or spuriously red. `spanGroup`
 * coverage stays on `@la/lang-fake`'s discontinuous-span fixture until a
 * future zh separable-verb expansion child re-introduces it.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Band, TurnIntent } from "@la/contract";
import type { GoldenCase, GoldenExpectedToken } from "./types.js";

const BANDS: readonly Band[] = ["GREEN", "YELLOW", "RED"];

/** Load every `*.json` golden case in `goldenDir`, sorted by filename.
 * Throws with the offending file path on any malformed case. */
export function loadGoldenCases(goldenDir: string): GoldenCase[] {
  const files = readdirSync(goldenDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  if (files.length === 0) {
    throw new Error(`golden corpus is empty: no *.json cases in ${goldenDir}`);
  }
  return files.map((file) => {
    const path = join(goldenDir, file);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(path, "utf8"));
    } catch (err) {
      throw new Error(`golden case ${path} is not valid JSON: ${String(err)}`);
    }
    return parseGoldenCase(raw, path, file.slice(0, -".json".length));
  });
}

function fail(path: string, message: string): never {
  throw new Error(`golden case ${path}: ${message}`);
}

function parseGoldenCase(raw: unknown, path: string, id: string): GoldenCase {
  if (!isRecord(raw)) fail(path, "top level must be an object");
  const { name, targetText, intents, expected } = raw;
  if (typeof name !== "string" || name.length === 0) {
    fail(path, "`name` must be a non-empty string");
  }
  if (typeof targetText !== "string" || targetText.length === 0) {
    fail(path, "`targetText` must be a non-empty string");
  }
  if (!Array.isArray(intents)) fail(path, "`intents` must be an array");
  const parsedIntents: TurnIntent[] = intents.map((intent, i) => {
    if (!isRecord(intent)) {
      fail(path, `intents[${i}] must be { id: string, description: string }`);
    }
    const intentId = intent["id"];
    const description = intent["description"];
    if (typeof intentId !== "string" || typeof description !== "string") {
      fail(path, `intents[${i}] must be { id: string, description: string }`);
    }
    return { id: intentId, description };
  });
  if (!isRecord(expected)) fail(path, "`expected` must be an object");
  const rawTokens = expected["tokens"];
  if (!Array.isArray(rawTokens) || rawTokens.length === 0) {
    fail(path, "`expected.tokens` must be a non-empty array");
  }
  const tokens: GoldenExpectedToken[] = rawTokens.map((t, i) =>
    parseExpectedToken(t, path, i),
  );
  const annotations = expected["annotations"];
  if (!Array.isArray(annotations)) {
    fail(path, "`expected.annotations` must be an array");
  }
  if (annotations.length !== tokens.length) {
    fail(
      path,
      `\`expected.annotations\` must align with \`expected.tokens\` ` +
        `(${annotations.length} vs ${tokens.length})`,
    );
  }
  const floorsHold = expected["floorsHold"];
  if (floorsHold !== undefined && typeof floorsHold !== "boolean") {
    fail(path, "`expected.floorsHold` must be a boolean when present");
  }
  return {
    id,
    name,
    targetText,
    intents: parsedIntents,
    expected: {
      tokens,
      annotations,
      ...(floorsHold !== undefined ? { floorsHold } : {}),
    },
  };
}

function parseExpectedToken(
  raw: unknown,
  path: string,
  index: number,
): GoldenExpectedToken {
  if (!isRecord(raw)) fail(path, `expected.tokens[${index}] must be an object`);
  const { surface, band, spanGroup, neverAnglicize } = raw;
  if (typeof surface !== "string" || surface.length === 0) {
    fail(path, `expected.tokens[${index}].surface must be a non-empty string`);
  }
  if (typeof band !== "string" || !BANDS.includes(band as Band)) {
    fail(path, `expected.tokens[${index}].band must be one of ${BANDS.join("|")}`);
  }
  if (spanGroup !== undefined && typeof spanGroup !== "string") {
    fail(path, `expected.tokens[${index}].spanGroup must be a string when present`);
  }
  if (neverAnglicize !== undefined && neverAnglicize !== true) {
    fail(path, `expected.tokens[${index}].neverAnglicize must be true when present`);
  }
  return {
    surface,
    band: band as Band,
    ...(spanGroup !== undefined ? { spanGroup } : {}),
    ...(neverAnglicize === true ? { neverAnglicize: true } : {}),
  };
}

/** Whether the seam-5 floor law should hold over this case's stream
 * (explicit flag, defaulting to "every expected band is GREEN"). */
export function floorsShouldHold(goldenCase: GoldenCase): boolean {
  return (
    goldenCase.expected.floorsHold ??
    goldenCase.expected.tokens.every((t) => t.band === "GREEN")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
