/**
 * @la/lang-conformance — the language-pack TCK (ADR §4.1).
 *
 * `describeLanguagePack(name, makePack, { fixtures, fakes })` is the
 * parameterized Vitest suite any pack instantiates in ~10 lines; it runs
 * the six ADR §4.2 law categories as fast-check properties plus the
 * golden-fixture harness. `probeSidecar` is the black-box HTTP probe for
 * the CI matrix legs (generic over the sidecar surface — the OpenAPI
 * document and generated client are #7's, never defined here).
 *
 * Runtime dependency: @la/contract ONLY (never engine, never a lang-*
 * pack — ADR §4.1, enforced by dependency-cruiser). vitest/fast-check are
 * dev-time surfaces of the consuming pack's test run.
 */

export { describeLanguagePack } from "./describe-language-pack.js";
export { floorsShouldHold, loadGoldenCases } from "./golden.js";
export { assertProbesPass, probeSidecar } from "./probe-sidecar.js";
export type {
  ProbeSidecarOptions,
  SidecarBase,
  SidecarHttpFixture,
  SidecarProbeResult,
  SidecarTarget,
} from "./probe-sidecar.js";
export {
  canonicalJson,
  isOrderedSubsequence,
  multisetSubsetViolation,
} from "./canonical-json.js";
export type {
  ConformanceFakes,
  ConformanceFixtures,
  ConformanceOptions,
  FloorBoundaryFixture,
  GoldenCase,
  GoldenExpectedToken,
  MakeEventArgs,
  MakePack,
} from "./types.js";
export { TCK_SNAPSHOT } from "./types.js";
