/**
 * `@la/lang-zh`'s seam-5 `CurriculumPolicy` — the `SeedVocabBypassCurriculum`
 * stand-in (ADR §5.2 #9 pattern): candidates come ONLY from #20's committed
 * `assets/seed-tuples.json` known-set — no FSRS-due ranking, no
 * topic-relevance, no novelty budget.
 *
 * **The dual-floor v0 branch (read before changing `floors`):** design
 * §7.3 names a REAL dual coverage floor (word-coverage comprehension +
 * character-coverage decoding-load) — but that is a curriculum-CASCADE
 * concept (FSRS-due ranking, novelty budget, topic relevance) the seed-
 * vocab bypass explicitly does not implement (ADR §5.2). This call passes
 * NO `floors` override, so `makeSeedVocabBypassCurriculum` defaults to
 * `DEFAULT_FLOORS` (`nonempty-stream`, `green-majority`) — the SAME two
 * structural floors `@la/lang-ar/src/curriculum.ts` gets, NOT a hand-rolled
 * two-entry array simulating the real dual floor. The real §7.3 dual floor
 * is DEFERRED to Phase 3 (a future real `CurriculumPolicy`), per the ADR's
 * dual-instance amendment Decision 3 and the plan-review resolution on this
 * issue (comment 4872950090): "v0 declares no budget-style `CoverageFloor`
 * … a hard rule: if any budget floor IS declared it MUST ship matching
 * `fixtures.floorBoundaries` pins" (the PR #28 vacuous-pass trap this
 * branch avoids). Because this pack declares no budget floor,
 * `conformance-adapters.ts` ships no `floorBoundaries` — same as ar.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { makeSeedVocabBypassCurriculum } from "@la/engine";
import type { CurriculumPolicyFactory } from "@la/contract";
import { ZH_ASSETS_ROOT } from "./assets/root.js";
import { ZhSeedTuplesAssetSchema, type ZhSeedTuple } from "./assets/schema.js";
import { zhWordUnitRef } from "./react/ruby.js";

/** Synchronous load (never the async `PackContext.assets` reader — seam-5's
 * `candidates()` is a sync port; `@la/engine`'s factory documents why). */
function loadSeedTupleRows(): ZhSeedTuple[] {
  const raw = readFileSync(join(ZH_ASSETS_ROOT, "seed-tuples.json"), "utf8");
  return ZhSeedTuplesAssetSchema.parse(JSON.parse(raw)).tuples;
}

export const zhCurriculumPolicy: CurriculumPolicyFactory = makeSeedVocabBypassCurriculum({
  loadRows: loadSeedTupleRows,
  rowToUnit: (row) => zhWordUnitRef(row.readingId),
});
