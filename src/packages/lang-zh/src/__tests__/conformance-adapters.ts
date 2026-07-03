/**
 * `@la/lang-zh`'s TCK adapters (issue #21, mirroring `@la/lang-ar`'s
 * `conformance-adapters.ts` precedent): the golden-corpus location and the
 * pack-schema'd fakes the generic laws cannot construct themselves. zh's
 * mastery model (`FixedRatioScaffold`) declares TWO unit kinds (`word`,
 * `character`), zero gating/leak edges, and `stateVersion: 1` with no
 * prior version for either kind — so `stateExemplars` and
 * `floorBoundaries` are both unneeded (the migration law and the
 * budget-floor-boundary law are both vacuous for this declaration; see
 * `mastery.ts`'s header and `curriculum.ts`'s header for the two v0
 * deferral decisions this mirrors).
 */

import { fileURLToPath } from "node:url";
import type { ConformanceFakes, ConformanceFixtures } from "@la/lang-conformance";
import { makeTestContext } from "./test-context.js";

export const fixtures: ConformanceFixtures = {
  goldenDir: fileURLToPath(new URL("../../fixtures/golden/", import.meta.url)),
};

export const fakes: ConformanceFakes = {
  context: makeTestContext(),

  // zh-events/v1: the payload names the one dimension the evidence bears
  // on (the same minimal convention `@la/lang-ar`'s `ar-events/v1` uses).
  makeEvent: ({ tokenRef, units, dimension, renderedScaffold }) => ({
    tokenRef,
    unitRefs: units,
    renderedScaffold,
    payload: { schemaId: "zh-events/v1", dimension },
  }),

  masteredState: (kind) => {
    if (kind === "word") return { stateVersion: 1, state: { seen: 5 } };
    if (kind === "character") return { stateVersion: 1, state: { seen: 5 } };
    throw new Error(`@la/lang-zh declares no unit kind '${kind}'`);
  },
};
