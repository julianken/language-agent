/**
 * The turn loop's own narrow port surface — the six seams `runTurn` actually
 * calls (seams 1/2/3/4/5/7). Deliberately NOT an import of
 * `src/apps/server/src/composeApp.ts`'s `AppPorts` (that would make the
 * language-blind engine depend on the composition root — exactly backwards,
 * and disallowed by ADR §2.4 rule (a) in spirit even though the rule's
 * literal text targets `@la/lang-*`). TypeScript's structural typing makes
 * `composeApp`'s nine-field `AppPorts` assignable here without any import:
 * the composition root passes `app.ports` straight through.
 */

import type {
  AnnotationCodec,
  CurriculumPolicy,
  MasteryModel,
  SteeringPolicy,
  TtsDriver,
  VerificationGate,
} from "@la/contract";

export interface AppPorts {
  verificationGate: VerificationGate;
  steeringPolicy: SteeringPolicy;
  annotationCodec: AnnotationCodec;
  masteryModel: MasteryModel;
  curriculumPolicy: CurriculumPolicy;
  ttsDriver: TtsDriver;
}
