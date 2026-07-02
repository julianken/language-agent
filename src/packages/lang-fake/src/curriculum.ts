/**
 * The fake curriculum policy (seam 5). Two declared floors (mirroring zh's
 * dual floor — two entries the engine evaluates generically over the FULL
 * candidate token stream, ADR §1.3 port 5), both pure over explicit args.
 *
 * `candidates` is deliberately a small in-code seed list, NOT a mirror of
 * the lexicon asset: the port's `candidates()` signature is synchronous
 * (ADR §1.3 sketch) while the scoped asset reader is async — the seed
 * constants are the sync-safe fake shape; real packs hydrate inventories
 * in `make(ctx)` once #9's wiring gives that a consumer.
 */

import type {
  CoverageFloor,
  CurriculumPolicy,
  CurriculumPolicyFactory,
} from "@la/contract";

const floors: CoverageFloor[] = [
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

const SEED_CANDIDATES = [
  { unit: { kind: "word", id: "zip" } },
  { unit: { kind: "word", id: "zap" } },
  { unit: { kind: "word", id: "zorg" } },
];

export const fakeCurriculumPolicy: CurriculumPolicyFactory = {
  floors,
  make(_ctx): CurriculumPolicy {
    return {
      floors,
      candidates(_snapshot, _topic) {
        return SEED_CANDIDATES.map((c) => ({ unit: { ...c.unit } }));
      },
    };
  },
};
