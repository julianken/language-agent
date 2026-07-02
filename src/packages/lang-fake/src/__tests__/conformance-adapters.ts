/**
 * lang-fake's TCK adapters (owned by issue #17, like conformance.test.ts —
 * #16 owns the pack, not its conformance instantiation): the golden-corpus
 * location, the floor boundary pins, and the pack-schema'd fakes the
 * generic laws cannot construct themselves (event payloads, unit-state
 * rows). Kept out of conformance.test.ts so the instantiation stays the
 * ~10-line `describeLanguagePack` call the ADR §4.1 promises.
 */

import { fileURLToPath } from "node:url";
import type { TokenSpine, UnitState } from "@la/contract";
import type {
  ConformanceFakes,
  ConformanceFixtures,
} from "@la/lang-conformance";
import { makeTestContext } from "./test-context.js";

/** A minimal GREEN word spine for floor-boundary streams. */
function spine(id: string, surface: string): TokenSpine {
  return { id, lang: "fake", surface, kind: "word", status: "new", band: "GREEN" };
}

export const fixtures: ConformanceFixtures = {
  goldenDir: fileURLToPath(new URL("../../fixtures/golden/", import.meta.url)),
  floorBoundaries: [
    {
      // glyph-decoding-load budgets MEAN glyph units (non-space chars) per
      // token at 4, INCLUSIVE (curriculum.ts). The boundary pin (PR #26
      // routed SUGGESTION 2): mean exactly 4 passes; one glyph over fails.
      floorId: "glyph-decoding-load",
      atBudget: [spine("at-1", "zip"), spine("at-2", "zorgs")], // (3+5)/2 = 4
      overBudget: [spine("over-1", "zorg"), spine("over-2", "zorgs")], // (4+5)/2 = 4.5
    },
  ],
};

const MASTERED: Record<string, UnitState> = {
  word: { stateVersion: 2, state: { seen: 5, stressSeen: 3, mastered: true } },
  glyph: { stateVersion: 1, state: { p: 1 } },
};

export const fakes: ConformanceFakes = {
  context: makeTestContext(),

  // fake-events/v1 (mastery.ts): the payload names the one dimension the
  // evidence bears on.
  makeEvent: ({ tokenRef, units, dimension, renderedScaffold }) => ({
    tokenRef,
    unitRefs: units,
    renderedScaffold,
    payload: { schemaId: "fake-events/v1", dimension },
  }),

  masteredState: (kind) => {
    const row = MASTERED[kind];
    if (row === undefined) {
      throw new Error(`lang-fake declares no unit kind '${kind}'`);
    }
    return row;
  },

  stateExemplars: {
    word: [
      // v1 witness: migrateWordState's declared prior version (totality).
      { stateVersion: 1, state: { timesSeen: 3 } },
      { stateVersion: 2, state: { seen: 2, stressSeen: 1, mastered: false } },
    ],
    glyph: [{ stateVersion: 1, state: { p: 0.5 } }],
  },
};
