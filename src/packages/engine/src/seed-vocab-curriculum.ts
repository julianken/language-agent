/**
 * `SeedVocabBypassCurriculum` — the seam-5 (`CurriculumPolicy`) stand-in
 * `composeApp` binds for the walking skeleton (ADR §5.2 #9): candidates come
 * from a pack's committed seed-vocab asset ONLY — no FSRS-due ranking, no
 * topic-relevance, no novelty budget (that's the "cascade" this bypasses).
 * Authored here (this issue's own deliverable, ADR §5.2), generic and
 * reusable the same way `fixed-ratio-scaffold.ts` is.
 *
 * `CurriculumPolicy.candidates()` is SYNCHRONOUS per the contract's port
 * sketch (`@la/contract/src/ports.ts` seam 5), while `PackContext.assets`
 * is an ASYNC reader — `@la/lang-fake`'s curriculum hits the same
 * mismatch and resolves it with in-code seed constants ("the seed
 * constants are the sync-safe fake shape"). A real pack's seed vocab is a
 * small, already-committed JSON file, so the sync-safe answer here is a
 * synchronous `loadRows()` the pack supplies (a plain `readFileSync` +
 * `JSON.parse` + its own row schema, never the async `PackContext.assets`
 * reader) — read once, at `make()` time.
 */

import type { CoverageFloor, CurriculumPolicy, CurriculumPolicyFactory, UnitRef } from "@la/contract";

const DEFAULT_FLOORS: CoverageFloor[] = [
  {
    id: "nonempty-stream",
    satisfied: (candidateStream) => candidateStream.length > 0,
  },
  {
    id: "green-majority",
    satisfied: (candidateStream) =>
      candidateStream.filter((t) => t.band === "GREEN").length * 2 >=
      candidateStream.length,
  },
];

export interface SeedVocabCurriculumConfig<Row> {
  /** Synchronously load the committed known-set rows — see file header for
   * why this must be sync, never the async scoped asset reader. */
  loadRows(): Row[];
  /** Map one seed-vocab row to its canonical `UnitRef`. */
  rowToUnit(row: Row): UnitRef;
  /** Declared coverage floors this policy evaluates (defaults to the two
   * structural floors every pack needs: a non-empty stream and a GREEN
   * majority). */
  floors?: CoverageFloor[];
}

/**
 * The generic factory. `make()` loads the seed rows ONCE (memoized for the
 * lifetime of the composed app) and returns them verbatim as candidates —
 * no ranking, no selection: "the seed-vocab known-set only" (ADR §5.2 #9).
 */
export function makeSeedVocabBypassCurriculum<Row>(
  config: SeedVocabCurriculumConfig<Row>,
): CurriculumPolicyFactory {
  const floors = config.floors ?? DEFAULT_FLOORS;
  return {
    floors,
    make(_ctx): CurriculumPolicy {
      const units = config.loadRows().map((row) => config.rowToUnit(row));
      return {
        floors,
        candidates(_snapshot, _topic) {
          return units.map((unit) => ({ unit: { ...unit } }));
        },
      };
    },
  };
}
