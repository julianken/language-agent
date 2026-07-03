/**
 * `@la/lang-ar`'s TCK adapters (issue #9, mirroring `@la/lang-fake`'s
 * `conformance-adapters.ts` precedent): the golden-corpus location and the
 * pack-schema'd fakes the generic laws cannot construct themselves. ar's
 * mastery model (`FixedRatioScaffold`, `@la/engine`) declares ONE unit kind
 * (`lemma`), zero gating/leak edges, and `stateVersion: 1` with no prior
 * version — so `stateExemplars` and `floorBoundaries` are both unneeded
 * (the migration law and the budget-floor-boundary law are both vacuous for
 * this declaration).
 */

import { fileURLToPath } from "node:url";
import type { ConformanceFakes, ConformanceFixtures } from "@la/lang-conformance";
import { makeTestContext } from "./test-context.js";

export const fixtures: ConformanceFixtures = {
  goldenDir: fileURLToPath(new URL("../../fixtures/golden/", import.meta.url)),
};

export const fakes: ConformanceFakes = {
  context: makeTestContext(),

  // ar-events/v1: the payload names the one dimension the evidence bears on
  // (the same minimal convention `@la/lang-fake`'s `fake-events/v1` uses).
  makeEvent: ({ tokenRef, units, dimension, renderedScaffold }) => ({
    tokenRef,
    unitRefs: units,
    renderedScaffold,
    payload: { schemaId: "ar-events/v1", dimension },
  }),

  masteredState: (kind) => {
    if (kind !== "lemma") {
      throw new Error(`@la/lang-ar declares no unit kind '${kind}'`);
    }
    return { stateVersion: 1, state: { seen: 5 } };
  },
};
