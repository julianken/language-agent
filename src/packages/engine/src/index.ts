// @la/engine — the language-blind turn-loop engine (issue #9).
//
// Engine is language-blind: it must never import a `@la/lang-*` package
// (ADR §2.4 rule a, enforced by .dependency-cruiser.cjs + pnpm strict
// resolution), must never branch on `lang === ` / `language === `
// (ADR §2.4 mechanism 4, enforced by eslint.config.mjs +
// scripts/check-no-lang-conditional.sh), and must never interpret the
// seam-4 display-scaffold levels (ADR §1.5, enforced by a dedicated
// boundary script under scripts/) — that interpretation is exclusively
// pack-owned. That is WHY the seam-4 stand-in ("FixedRatioScaffold") is
// authored per-pack (`@la/lang-ar`'s own `mastery.ts`), not exported from
// here. The seam-5 stand-in below carries no such vocabulary at all and
// lives here safely.
//
// Content: the turn loop (generate → verify → anglicize, ADR §1.5), the
// tutor-message wire-schema builder (architecture.md §3), the injected
// `CandidateGenerator` boundary, and the reusable seam-5 walking-skeleton
// stand-in (`SeedVocabBypassCurriculum`) a pack's own manifest configures.

export type { AppPorts } from "./ports.js";
export type {
  CandidateGenerator,
  GenerateCandidatesArgs,
  GeneratedCandidate,
} from "./candidate-generator.js";
export { DEFAULT_RUN_TURN_CONFIG, runTurn } from "./turn-loop.js";
export type { RunTurnConfig, RunTurnInput, RunTurnResult } from "./turn-loop.js";
export {
  buildEnglishFallbackMessage,
  buildTutorMessage,
  TutorMessageBlendSchema,
  TutorMessageSchema,
  TutorTokenSchema,
} from "./tutor-message.js";
export type {
  BuildTutorMessageArgs,
  TutorMessage,
  TutorMessageBlend,
  TutorToken,
} from "./tutor-message.js";
export { makeSeedVocabBypassCurriculum } from "./seed-vocab-curriculum.js";
export type { SeedVocabCurriculumConfig } from "./seed-vocab-curriculum.js";
