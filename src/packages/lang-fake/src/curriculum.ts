/**
 * The fake curriculum policy (seam 5). Declared floors the engine (and
 * #17's seam-5 curriculum law category — "the winning candidate's token
 * stream never violates a declared floor") evaluates generically over the
 * FULL candidate token stream (ADR §1.3 port 5), all pure over explicit
 * args. Three floors on purpose (issue #16 amendment, surfaced by #17's
 * plan review: max topology = every TCK category has a live in-tree
 * exerciser): two structural checks plus `glyph-decoding-load`, the fake
 * mirror of zh's character decoding-load floor — a floor tied to a
 * declared UNIT KIND, not just stream shape.
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

/** Decoding-load budget: mean glyph units per token across the FULL
 * stream. The fake's `glyph` kind is its character analog, so this is
 * zh's "character decoding-load" floor shape (ADR §1.3 port 5's dual
 * floor), computable from spines alone. */
const MAX_MEAN_GLYPHS_PER_TOKEN = 4;

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
  {
    id: "glyph-decoding-load",
    // Per-unit-kind floor over the full stream: the mean number of glyph
    // units a token carries (non-space chars of its surface — exactly how
    // `glyphsOf` mints glyph units) must not exceed the budget. Empty
    // stream is vacuously within budget.
    satisfied: (candidateStream) => {
      if (candidateStream.length === 0) return true;
      const glyphUnits = candidateStream.reduce(
        (n, t) => n + t.surface.replaceAll(" ", "").length,
        0,
      );
      return glyphUnits / candidateStream.length <= MAX_MEAN_GLYPHS_PER_TOKEN;
    },
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
