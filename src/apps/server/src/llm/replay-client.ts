/**
 * The deterministic LLM replay/fixture client (ADR §3.6, §4.3) — this
 * issue's new deliverable. Loads per-leg recorded structured-output
 * responses from a directory of `*.json` fixture files, keyed on the exact
 * `learnerMessage` string a caller passes. Makes the PR-blocking E2E fully
 * deterministic: `ReplayCandidateGenerator` never performs network I/O.
 *
 * **Provenance policy (binding, step 7 of #9; also binds #21's zh
 * recordings loaded through this SAME client):** every fixture file is
 * AGENT-AUTHORED — never a captured live response — schema-valid against
 * the structured-output shape verified from the live Anthropic docs (this
 * PR's step 10), and carries the explicit `source: "authored"` marker the
 * schema below REJECTS a fixture for omitting. Presenting an authored
 * fixture as a live capture would be dishonest; this class refuses to load
 * one that doesn't say so. When a live product Anthropic key exists, the
 * corpora are re-recorded live and provenance flips to `source: "recorded"`
 * — tracked as a `GAPS.md` deferred-with-trigger row.
 *
 * A fixture's `attempts` array supports the regenerate-on-RED repair path:
 * each entry is one generation attempt's candidate pool; a caller that
 * calls `generate()` more times than there are recorded attempts gets the
 * LAST recorded attempt repeated (never throws mid-loop on an
 * under-recorded fixture).
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { CandidateGenerator, GenerateCandidatesArgs, GeneratedCandidate } from "@la/engine";

const ReplayFixtureSchema = z.object({
  source: z.literal("authored"),
  learnerMessage: z.string().min(1),
  attempts: z
    .array(z.array(z.object({ text: z.string().min(1) })).min(1))
    .min(1),
});
type ReplayFixture = z.infer<typeof ReplayFixtureSchema>;

export interface ReplayCandidateGeneratorOptions {
  /** Directory of `*.json` authored fixture files for ONE matrix leg (e.g.
   * `fixtures/llm-replay/fake` or `fixtures/llm-replay/ar`). */
  fixturesDir: string;
}

export class ReplayCandidateGenerator implements CandidateGenerator {
  private readonly fixturesDir: string;
  private readonly callCounts = new Map<string, number>();
  private cache: Map<string, ReplayFixture> | undefined;

  constructor(options: ReplayCandidateGeneratorOptions) {
    this.fixturesDir = options.fixturesDir;
  }

  private loadAll(): Map<string, ReplayFixture> {
    if (this.cache) return this.cache;
    const map = new Map<string, ReplayFixture>();
    const files = readdirSync(this.fixturesDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const path = join(this.fixturesDir, file);
      let raw: unknown;
      try {
        raw = JSON.parse(readFileSync(path, "utf8"));
      } catch (cause) {
        throw new Error(`replay fixture ${path} is not valid JSON`, { cause });
      }
      const parsed = ReplayFixtureSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error(
          `replay fixture ${path} failed schema validation (provenance policy: every ` +
            `fixture must carry source:"authored"): ${JSON.stringify(parsed.error.issues)}`,
        );
      }
      if (map.has(parsed.data.learnerMessage)) {
        throw new Error(
          `replay fixtures in ${this.fixturesDir}: duplicate learnerMessage ` +
            `${JSON.stringify(parsed.data.learnerMessage)} (in ${file})`,
        );
      }
      map.set(parsed.data.learnerMessage, parsed.data);
    }
    this.cache = map;
    return map;
  }

  async generate(args: GenerateCandidatesArgs): Promise<GeneratedCandidate[]> {
    const fixture = this.loadAll().get(args.learnerMessage);
    if (!fixture) {
      throw new Error(
        `ReplayCandidateGenerator: no authored fixture for learnerMessage ` +
          `${JSON.stringify(args.learnerMessage)} in ${this.fixturesDir}`,
      );
    }
    const callIndex = this.callCounts.get(args.learnerMessage) ?? 0;
    this.callCounts.set(args.learnerMessage, callIndex + 1);
    const attemptIndex = Math.min(callIndex, fixture.attempts.length - 1);
    const attempt = fixture.attempts[attemptIndex] ?? [];
    return attempt.slice(0, args.n).map((c): GeneratedCandidate => ({ text: c.text }));
  }
}
