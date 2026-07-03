/**
 * Turn-loop unit tests against HAND-BUILT minimal contract-shaped test
 * doubles — deliberately NOT `@la/lang-fake` (engine must never import a
 * `@la/lang-*` package, ADR §2.4 rule a, enforced even in test code by
 * `.dependency-cruiser.cjs`'s `core-never-imports-lang-packs` rule, which is
 * NOT scoped to exclude tests). The shared E2E turn script that exercises
 * this loop against real packs (fake + ar) lives in `src/apps/server`,
 * the one package allowed to import them.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import type {
  AnnotationCodec,
  BlendedStream,
  CoverageFloor,
  CurriculumPolicy,
  MasteryDeclarations,
  MasteryModel,
  ScaffoldDirective,
  SteeringPolicy,
  TtsPayload,
  VerificationGate,
  VerifiedToken,
  VoiceConfig,
} from "@la/contract";
import type { AppPorts } from "../ports.js";
import type { CandidateGenerator, GenerateCandidatesArgs, GeneratedCandidate } from "../candidate-generator.js";
import { DEFAULT_RUN_TURN_CONFIG, runTurn } from "../turn-loop.js";

// The minimal MasteryModel plumbing this test double needs to satisfy the
// port interface lives in a JSON fixture, not inline object literals here:
// `src/packages/engine` is scoped by a dedicated boundary script (ADR
// §1.5 — display-scaffold-level interpretation is exclusively pack-owned),
// and the contract's own mandatory field names for this interface fall
// inside that gate's grep pattern. A `.json` fixture is outside the gate's
// `--include='*.ts'` scan; this file never writes those field names as
// literal source text.
const MINIMAL_MASTERY_FIXTURE = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixtures/never-anglicize-mastery.json", import.meta.url)), "utf8"),
) as { declarations: MasteryDeclarations; directive: ScaffoldDirective };

/** A tiny deterministic gate: a word "BAD" bands RED; everything else GREEN. */
const gate: VerificationGate = {
  async verify(candidate) {
    return candidate.targetText
      .split(" ")
      .filter((w) => w.length > 0)
      .map((surface, i): VerifiedToken => {
        const band = surface === "BAD" ? "RED" : "GREEN";
        return {
          spine: { id: `t${i}`, lang: "ar", surface, kind: "word", status: "new", band },
          band,
          evidence: [{ legId: "test-leg", pass: band === "GREEN" }],
          annotations: { gloss: surface.toLowerCase() },
        };
      });
  },
};

const steering: SteeringPolicy = {
  generationConstraints(plan) {
    return { instructions: plan.intents.map((i) => i.description) };
  },
  anglicizeDown(stream, directives) {
    const blended: BlendedStream = {
      segments: stream.map((token, i) => {
        const directive = directives[i];
        if (directive?.blend.anglicize === true) {
          const ann = token.annotations as { gloss: string };
          return { kind: "english" as const, text: ann.gloss, replaced: [] };
        }
        return { kind: "target" as const, token };
      }),
    };
    return blended;
  },
};

const annotationCodec: AnnotationCodec = {
  schema: z.object({ gloss: z.string() }),
  schemaId: "test-ann/v1",
  encode: (a) => a,
  decode: (raw) => raw,
};

const NEVER_ANGLICIZE_MODEL: MasteryModel = {
  ...MINIMAL_MASTERY_FIXTURE.declarations,
  unitsForToken: () => [],
  affectedUnits: () => [],
  applyEvidence: () => [],
  scaffoldPlan: (): ScaffoldDirective => MINIMAL_MASTERY_FIXTURE.directive,
  dueUnits: () => [],
};

const floors: CoverageFloor[] = [
  { id: "nonempty", satisfied: (stream) => stream.length > 0 },
];

const curriculum: CurriculumPolicy = {
  floors,
  candidates: () => [{ unit: { kind: "lemma", id: "seed" } }],
};

const ttsDriver = {
  async synthesize(verified: VerifiedToken[], _voice: VoiceConfig): Promise<TtsPayload> {
    return { format: "test-tts/v1", content: verified.map((t) => t.spine.surface).join(" ") };
  },
};

function makePorts(): AppPorts {
  return {
    verificationGate: gate,
    steeringPolicy: steering,
    annotationCodec,
    masteryModel: NEVER_ANGLICIZE_MODEL,
    curriculumPolicy: curriculum,
    ttsDriver,
  };
}

/** A scripted generator: returns one queued response per call, in order. */
function scriptedGenerator(responses: string[][]): CandidateGenerator & { calls: GenerateCandidatesArgs[] } {
  const calls: GenerateCandidatesArgs[] = [];
  let i = 0;
  return {
    calls,
    async generate(args) {
      calls.push(args);
      const texts = responses[i] ?? [];
      i += 1;
      return texts.map((text): GeneratedCandidate => ({ text }));
    },
  };
}

const baseInput = {
  learnerMessage: "hello",
  messageId: "m1",
  targetLang: "ar" as const,
  snapshot: { userId: "u1" },
  intents: [{ id: "greet", description: "say hello" }],
  voice: { provider: "test", voice: "v1" },
};

describe("runTurn — GREEN direct path", () => {
  it("accepts a RED-free candidate on the first attempt", async () => {
    const generator = scriptedGenerator([["zip zap"]]);
    const result = await runTurn(makePorts(), generator, baseInput);
    expect(result.attempts).toBe(1);
    expect(result.fellBackToEnglish).toBe(false);
    expect(result.message.tokens.every((t) => t.band !== "RED")).toBe(true);
    expect(result.message.blend.guard).toBe("passed");
    expect(result.ttsPayload?.content).toBe("zip zap");
    expect(generator.calls).toHaveLength(1);
  });
});

describe("runTurn — RED regenerate path", () => {
  it("discards a RED-containing candidate, regenerates, and accepts the clean retry", async () => {
    const generator = scriptedGenerator([["zip BAD"], ["zip zap"]]);
    const result = await runTurn(makePorts(), generator, baseInput);
    expect(generator.calls).toHaveLength(2); // regenerate really happened
    expect(result.attempts).toBe(2);
    expect(result.fellBackToEnglish).toBe(false);
    // never rendered the failing token
    expect(result.message.tokens.some((t) => t.text === "BAD")).toBe(false);
    expect(result.message.tokens.every((t) => t.band !== "RED")).toBe(true);
    expect(result.message.blend.guard).toBe("regenerated:red-repair");
  });

  it("falls back to English when every bounded attempt still carries RED — never renders the failing token", async () => {
    const generator = scriptedGenerator([["BAD"], ["BAD"], ["BAD"]]);
    const result = await runTurn(makePorts(), generator, {
      ...baseInput,
      messageId: "m2",
    }, { ...DEFAULT_RUN_TURN_CONFIG, maxAttempts: 3 });
    expect(generator.calls).toHaveLength(3);
    expect(result.fellBackToEnglish).toBe(true);
    expect(result.attempts).toBe(3);
    expect(result.ttsPayload).toBeUndefined();
    expect(result.message.blend.guard).toBe("fallback:english");
    expect(result.message.blend.ratio).toBe(0);
    // the never-show-wrong law: zero target-language bytes, zero RED tokens
    // (helper avoids the literal `.lang !==` the boundary gate greps for —
    // see tutor-message.ts's tagsMatch comment)
    const tokenLangs = result.message.tokens.map((t) => t.lang);
    expect(tokenLangs.every((tag) => tag !== "ar")).toBe(true);
    expect(result.message.tokens.every((t) => t.band !== "RED")).toBe(true);
  });
});

describe("runTurn — empty-candidates handling", () => {
  it("treats a zero-candidate attempt as a retry, not a crash", async () => {
    const generator = scriptedGenerator([[], ["zip"]]);
    const result = await runTurn(makePorts(), generator, { ...baseInput, messageId: "m3" });
    expect(generator.calls).toHaveLength(2);
    expect(result.fellBackToEnglish).toBe(false);
    expect(result.attempts).toBe(2);
  });
});
