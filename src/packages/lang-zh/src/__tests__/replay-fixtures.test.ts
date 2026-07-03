/**
 * Deliverable 3's COMMITTED check (issue #21, folded from the plan
 * review's SUGGESTION → HARD RULE resolution, comment 4872950090): "no
 * cross-word 3+-syllable third-tone run" must be a committed
 * check/test — not a PR-description attestation — mirroring the
 * `source:"authored"` provenance schema enforcement
 * (`src/apps/server/src/llm/replay-client.ts`'s `ReplayFixtureSchema`).
 *
 * This test lives HERE (inside `@la/lang-zh`, not
 * `src/apps/server/src/__tests__/e2e-turn.test.ts`) per this PR's §5 scope
 * decision: the shared E2E turn script's `LEGS` table is `"fake" | "ar"`
 * only and sits outside this issue's sanctioned-edit list, so this pack
 * reads the same committed replay fixtures
 * (`src/apps/server/fixtures/llm-replay/zh/*.json`, every file agent-
 * authored per the SAME provenance policy `replay-client.ts` enforces —
 * `source: "authored"`, never a captured live response) and asserts the
 * third-tone property directly, independent of whether the shared E2E
 * script ever loads this leg.
 *
 * The check: segment each candidate text greedily against the committed
 * `assets/seed-tuples.json` known-set (the ONLY vocabulary these
 * agent-authored fixtures are allowed to use — real-world enforcement:
 * every word actually IS in the sliver, checked below too) to recover a
 * per-syllable CITATION tone sequence (mirrors
 * `src/sidecars/zh/app/legs/sandhi.py`'s stream-of-(unit, syllable) walk,
 * operating on tone digits rather than the sidecar's internal tone3
 * strings), then scans for any run of ≥3 consecutive tone-3 syllables
 * that spans MORE THAN ONE WORD — exactly the property
 * `sandhi.py`'s `Regenerate("crossword-third-tone-run", …)` guards
 * against on the real gate path.
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ZH_ASSETS_ROOT } from "../assets/root.js";
import { ZhC9ContextTableAssetSchema, ZhSeedTuplesAssetSchema } from "../assets/schema.js";

const REPLAY_FIXTURES_DIR = fileURLToPath(
  new URL("../../../../apps/server/fixtures/llm-replay/zh/", import.meta.url),
);

interface ReplayFixture {
  source: string;
  learnerMessage: string;
  attempts: Array<Array<{ text: string }>>;
}

function loadReplayFixtures(): Array<{ file: string; fixture: ReplayFixture }> {
  const files = readdirSync(REPLAY_FIXTURES_DIR).filter((f) => f.endsWith(".json"));
  return files.map((file) => ({
    file,
    fixture: JSON.parse(readFileSync(`${REPLAY_FIXTURES_DIR}${file}`, "utf8")) as ReplayFixture,
  }));
}

/** word/single (sorted longest-first) → per-syllable citation TONE DIGIT
 * sequence, e.g. "可以" → [3, 3] (kě=3, yǐ=3 — before the sandhi resolver
 * ever runs; this check operates on CITATION tone, matching sandhi.py's
 * own "Third-tone runs over BASE tones" comment). Covers BOTH the
 * `seed-tuples.json` word entries and the C3 single-character function
 * words (的/了/不/一/嗎/呢) via their `c9-context-table.json` citation
 * `base` tone3 (consistent across every context entry for a given char). */
function loadWordToneMap(): Map<string, number[]> {
  const map = new Map<string, number[]>();

  const tuplesRaw = readFileSync(`${ZH_ASSETS_ROOT}seed-tuples.json`, "utf8");
  const tuplesAsset = ZhSeedTuplesAssetSchema.parse(JSON.parse(tuplesRaw));
  for (const tuple of tuplesAsset.tuples) {
    const tones = tuple.citationPinyin.map((syl) => {
      const digit = syl.match(/(\d)$/)?.[1];
      return digit ? Number(digit) : 5;
    });
    map.set(tuple.word, tones);
  }

  const c9Raw = readFileSync(`${ZH_ASSETS_ROOT}c9-context-table.json`, "utf8");
  const c9Asset = ZhC9ContextTableAssetSchema.parse(JSON.parse(c9Raw));
  for (const single of c9Asset.singles) {
    if (map.has(single)) continue;
    const entry = c9Asset.entries.find((e) => e.char === single);
    if (!entry) continue;
    const digit = entry.base.match(/(\d)$/)?.[1];
    map.set(single, [digit ? Number(digit) : 5]);
  }

  return map;
}

/** Greedy longest-match segmentation against the known sliver vocabulary
 * (this suite's fixtures are constrained to sliver words by construction
 * — `word` presence is asserted per-token below, so an unmatched
 * character is a fixture-authoring bug, not a silently-skipped byte). */
function segment(text: string, wordTones: Map<string, number[]>, maxLen: number): Array<{ word: string; tones: number[] }> {
  const chars = [...text].filter((ch) => !/[\s。，、？！：；「」『』（）]/u.test(ch));
  const out: Array<{ word: string; tones: number[] }> = [];
  let i = 0;
  while (i < chars.length) {
    let matched = false;
    for (let len = Math.min(maxLen, chars.length - i); len >= 1; len -= 1) {
      const candidate = chars.slice(i, i + len).join("");
      const tones = wordTones.get(candidate);
      if (tones) {
        out.push({ word: candidate, tones });
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      throw new Error(
        `replay-fixtures third-tone check: character '${chars[i]}' at position ${i} of ${JSON.stringify(text)} ` +
          "is not covered by any word in the committed seed-tuples.json sliver — every replay fixture must " +
          "stay inside the known-set vocabulary.",
      );
    }
  }
  return out;
}

/** Cross-word 3+-syllable third-tone run detector — mirrors
 * `sandhi.py`'s stream walk: flatten to (wordIndex, tone) pairs, find
 * maximal tone-3 runs, and fail when a run of length ≥3 touches more
 * than one distinct word index. */
function crossWordThirdToneRuns(segments: Array<{ word: string; tones: number[] }>): string[] {
  const stream: Array<{ wordIndex: number; tone: number }> = [];
  segments.forEach((seg, wordIndex) => {
    for (const tone of seg.tones) stream.push({ wordIndex, tone });
  });
  const violations: string[] = [];
  let pos = 0;
  while (pos < stream.length) {
    if (stream[pos]?.tone !== 3) {
      pos += 1;
      continue;
    }
    let end = pos;
    while (end + 1 < stream.length && stream[end + 1]?.tone === 3) end += 1;
    const length = end - pos + 1;
    const distinctWords = new Set(stream.slice(pos, end + 1).map((s) => s.wordIndex));
    if (length >= 3 && distinctWords.size > 1) {
      const involvedWords = segments
        .filter((_s, i) => distinctWords.has(i))
        .map((s) => s.word)
        .join("");
      violations.push(`${length}-syllable cross-word third-tone run spanning ${distinctWords.size} words: ${involvedWords}`);
    }
    pos = end + 1;
  }
  return violations;
}

describe("zh LLM replay fixtures — provenance + the committed third-tone check", () => {
  const wordTones = loadWordToneMap();
  const maxLen = Math.max(...[...wordTones.keys()].map((w) => w.length));
  const fixtures = loadReplayFixtures();

  it("at least one fixture is committed", () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it.each(fixtures.map(({ file, fixture }) => [file, fixture] as const))(
    "%s: source is 'authored' (never a captured live response — provenance policy)",
    (_file, fixture) => {
      expect(fixture.source).toBe("authored");
    },
  );

  it.each(fixtures.map(({ file, fixture }) => [file, fixture] as const))(
    "%s: no attempt's candidate text contains a cross-word 3+-syllable third-tone run",
    (file, fixture) => {
      for (const attempt of fixture.attempts) {
        for (const candidate of attempt) {
          const segments = segment(candidate.text, wordTones, maxLen);
          const violations = crossWordThirdToneRuns(segments);
          expect(violations, `${file} candidate ${JSON.stringify(candidate.text)}`).toEqual([]);
        }
      }
    },
  );
});
