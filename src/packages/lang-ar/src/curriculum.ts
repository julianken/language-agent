/**
 * `@la/lang-ar`'s seam-5 `CurriculumPolicy` — the `SeedVocabBypassCurriculum`
 * stand-in (ADR §5.2 #9): candidates come ONLY from #8's committed
 * `assets/seed-vocab.json` known-set — no FSRS-due ranking, no
 * topic-relevance, no novelty budget. The generic factory is authored in
 * `@la/engine` (this issue's own deliverable); this module supplies ar's
 * row loader + `UnitRef` mapping, keyed identically to `arMasteryModel`
 * and the `/react` renderer (`arLemmaUnitRef`, `lemma#gloss`) so all three
 * seams agree on one unit-id convention.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { makeSeedVocabBypassCurriculum } from "@la/engine";
import type { CurriculumPolicyFactory } from "@la/contract";
import { AR_ASSETS_ROOT } from "./assets/root.js";
import { ArSeedVocabSchema, type ArSeedVocabRow } from "./assets/schema.js";
import { arLemmaUnitRef } from "./react/harakat.js";

/** Synchronous load (never the async `PackContext.assets` reader — seam-5's
 * `candidates()` is a sync port; `@la/engine`'s factory documents why). */
function loadSeedVocabRows(): ArSeedVocabRow[] {
  const raw = readFileSync(join(AR_ASSETS_ROOT, "seed-vocab.json"), "utf8");
  return ArSeedVocabSchema.parse(JSON.parse(raw));
}

export const arCurriculumPolicy: CurriculumPolicyFactory = makeSeedVocabBypassCurriculum({
  loadRows: loadSeedVocabRows,
  rowToUnit: (row) => arLemmaUnitRef({ lemma: row.lemma, gloss: row.gloss }),
});
