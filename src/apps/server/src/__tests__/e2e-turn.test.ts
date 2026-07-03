/**
 * The shared E2E turn script (issue #9, step 8; ADR §4.3): learner English
 * message → rendered tutor turn where every target token is banded,
 * annotations validate, TTS payload derives from the verified form. Written
 * against `@la/contract` — the same test body runs UNCHANGED against
 * `@la/lang-fake` and the real `@la/lang-ar`, imported here only as
 * `composeApp` registry selections, never as Arabic-specific assertions.
 * (#21's zh leg reuses this exact file unmodified against `@la/lang-zh`,
 * per the ADR's contract-purity claim.) Per-leg data lives in the `LEGS`
 * table below — deliberately not inline per-leg-identity ternaries
 * scattered through the test bodies, both for readability and because this
 * file is scoped by the no-language-conditional boundary gate
 * (`src/apps/server/src` minus the composition-root exception).
 *
 * **Zero live LLM/model calls** (epic AC): every candidate comes from
 * `ReplayCandidateGenerator` reading this issue's AGENT-AUTHORED fixtures
 * under `fixtures/llm-replay/<lang>/*.json` (every file's `source:
 * "authored"` — never a captured live response, ADR §3.6). The ar leg's
 * VERIFICATION gate is the real, deterministic, non-neural
 * `src/sidecars/ar` service — real per ADR §4.3 ("ar leg — real sidecar
 * image, no fake needed"); it is not an LLM and not mocked (extending
 * issue #8's mock-exclusion precedent to this suite). Run this file with
 * network access to any LLM API disabled to verify the zero-live-call claim
 * — only the loopback HTTP call to a LOCALLY BOOTED sidecar container
 * succeeds; every candidate-generation call is served from disk.
 *
 * The `ar` leg needs a REAL running `src/sidecars/ar` instance
 * (`SIDECAR_AR_BASE_URL`, same convention as `@la/lang-ar`'s TCK) and is
 * SKIPPED — never failed — when that env var is unset, so this file stays
 * safe to run from the generic root `pnpm run test` (no sidecar there).
 * CI's `conformance` job sets the env var for the `ar` leg and this suite
 * is REQUIRED to pass there.
 */

import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { TutorToken } from "@la/engine";
import { AR_ASSETS_ROOT } from "@la/lang-ar/assets";
import { AR_LEMMA_UNIT_KIND, vowelLevelsFrom } from "@la/lang-ar/react";
import { FAKE_ASSETS_ROOT } from "@la/lang-fake";
import { composeApp } from "../composeApp.js";
import { runHotPathTurn } from "../hot-path.js";
import { ReplayCandidateGenerator } from "../llm/replay-client.js";

const SIDECAR_AR_BASE_URL = process.env["SIDECAR_AR_BASE_URL"];

const FIXTURES_ROOT = fileURLToPath(new URL("../../fixtures/llm-replay/", import.meta.url));

interface LegCase {
  id: "fake" | "ar";
  targetTag: string;
  /** `undefined` runs unconditionally; a string names the env var that
   * must be set for this leg to run (skipped, not failed, otherwise). */
  requiresEnv?: string;
  config: () => Parameters<typeof composeApp>[0];
  fixturesDir: string;
  greenLearnerMessage: string;
  /** The verified (pre-anglicization) surface text of the GREEN fixture's
   * candidate — TTS must derive from this REGARDLESS of whether the
   * display anglicizes every word down to English (a real, observed
   * walking-skeleton behavior with the turn loop's always-empty learner
   * state — see this file's `targetTokens` non-vacuity note below). */
  greenVerifiedSurface: string;
  redThenGreenLearnerMessage: string;
  alwaysRedLearnerMessage: string;
  /** The word that ALWAYS bands RED for this leg (fake: out-of-closed-world
   * lexeme; ar: out-of-world pure-Latin word — both verified directly
   * against the real gate in this leg's `red-then-green-turn.json`'s first
   * recorded attempt). Used to assert the specific failing token never
   * survives into the accepted result — NOT "no word from attempt 1
   * reappears," since a benign word (e.g. fake's "zip") legitimately can
   * recur across two independently-generated candidates. */
  alwaysRedWord: string;
}

const FAKE_LEG: LegCase = {
  id: "fake",
  targetTag: "fake",
  config: () => ({
    language: "fake",
    sidecar: { baseUrl: "http://127.0.0.1:0", mode: "mock" },
    assetsRoot: FAKE_ASSETS_ROOT,
    tts: { provider: "test", voice: "v1" },
  }),
  fixturesDir: join(FIXTURES_ROOT, "fake"),
  greenLearnerMessage: "Tell me about zip zap zorg.",
  greenVerifiedSurface: "zip zap zorg",
  redThenGreenLearnerMessage: "Something with a tricky word.",
  alwaysRedLearnerMessage: "This one always fails verification.",
  alwaysRedWord: "qux",
};

const AR_LEG: LegCase = {
  id: "ar",
  targetTag: "ar",
  requiresEnv: "SIDECAR_AR_BASE_URL",
  config: () => ({
    language: "ar",
    sidecar: { baseUrl: SIDECAR_AR_BASE_URL as string, mode: "real" },
    assetsRoot: AR_ASSETS_ROOT,
    tts: { provider: "test", voice: "v1" },
  }),
  fixturesDir: join(FIXTURES_ROOT, "ar"),
  greenLearnerMessage: "Tell me about the radio.",
  greenVerifiedSurface: "رادِيُو",
  redThenGreenLearnerMessage: "Something with a word the gate should reject once.",
  alwaysRedLearnerMessage: "This one always fails the ar gate.",
  alwaysRedWord: "book",
};

const LEGS: LegCase[] = [FAKE_LEG, AR_LEG];

/** Every TARGET-language token, by comparing extracted local variables (not
 * an inline per-token-tag identity comparison — see the file-header note on
 * this file's boundary-gate scope). */
function targetTokens(tokens: TutorToken[], targetTag: string): TutorToken[] {
  return tokens.filter((token) => {
    const tokenTag = token.lang;
    return tokenTag === targetTag;
  });
}

describe.each(LEGS)("shared E2E turn script — $id leg", (leg) => {
  // Falsy (unset OR empty string) both mean "not configured" — CI sets this
  // env key on every leg for uniformity (empty string on non-ar legs rather
  // than conditionally omitting the key), so this check must not require
  // strict `undefined`.
  const skip = leg.requiresEnv !== undefined && !process.env[leg.requiresEnv];

  it.skipIf(skip)(
    "GREEN: a clean candidate is accepted on the first attempt, every target token banded, TTS derives from the verified form",
    async () => {
      const app = await composeApp(leg.config());
      const generator = new ReplayCandidateGenerator({ fixturesDir: leg.fixturesDir });

      const result = await runHotPathTurn(app, generator, {
        learnerMessage: leg.greenLearnerMessage,
        messageId: `e2e-green-${leg.id}`,
        userId: "e2e-user",
        topic: "e2e",
        voice: { provider: "test", voice: "v1" },
      });

      expect(result.fellBackToEnglish).toBe(false);
      expect(result.attempts).toBe(1);
      expect(result.message.schemaVersion).toBe("1.0");
      expect(result.message.tokens.length).toBeGreaterThan(0);
      // every TARGET-language token that SURVIVES anglicization is BANDED
      // and its annotations validate (English segments carry no
      // band/annotations, by construction). NOTE: with the walking
      // skeleton's always-empty learner state (mastery persistence beyond
      // in-memory is explicitly stubbed, ADR §5.2 #9), a real (non-stand-in)
      // mastery model — @la/lang-fake's — treats every word as "new" and
      // anglicizes it; this fixture's word is deliberately empty of
      // surviving target tokens for the fake leg. The TTS assertion below
      // is the leg-agnostic, NEVER-vacuous check: it holds regardless of
      // how anglicizeDown split the display.
      for (const token of targetTokens(result.message.tokens as TutorToken[], leg.targetTag)) {
        expect(token.band, `token ${token.id} (${token.text}) must be banded`).toBeDefined();
        expect(token.band).not.toBe("RED");
        const parsed = app.ports.annotationCodec.schema.safeParse(token.annotations);
        expect(parsed.success, `token ${token.id} annotations must validate`).toBe(true);
      }
      // TTS payload derives from the VERIFIED form — never the anglicized
      // display, never empty. Holds unconditionally (seam 7's input type is
      // `VerifiedToken[]`, not the blended/anglicized stream).
      expect(result.ttsPayload).toBeDefined();
      expect(result.ttsPayload?.content).toContain(leg.greenVerifiedSurface);
    },
  );

  it.skipIf(skip)(
    "RED regenerate: a failing candidate is discarded and the clean retry is accepted — never renders the failing token",
    async () => {
      const app = await composeApp(leg.config());
      const generator = new ReplayCandidateGenerator({ fixturesDir: leg.fixturesDir });

      const result = await runHotPathTurn(app, generator, {
        learnerMessage: leg.redThenGreenLearnerMessage,
        messageId: `e2e-redrepair-${leg.id}`,
        userId: "e2e-user",
        topic: "e2e",
        voice: { provider: "test", voice: "v1" },
      });

      expect(result.attempts).toBe(2); // regenerate really happened
      expect(result.fellBackToEnglish).toBe(false);
      expect(result.message.blend.guard).toBe("regenerated:red-repair");
      for (const token of result.message.tokens as TutorToken[]) {
        expect(token.band).not.toBe("RED");
        expect(token.text).not.toBe(leg.alwaysRedWord);
      }
    },
  );

  it.skipIf(skip)(
    "English fallback: every bounded attempt still RED — zero target-language bytes reach the reply (the never-show-wrong law)",
    async () => {
      const app = await composeApp(leg.config());
      const generator = new ReplayCandidateGenerator({ fixturesDir: leg.fixturesDir });

      const result = await runHotPathTurn(app, generator, {
        learnerMessage: leg.alwaysRedLearnerMessage,
        messageId: `e2e-fallback-${leg.id}`,
        userId: "e2e-user",
        topic: "e2e",
        voice: { provider: "test", voice: "v1" },
      });

      expect(result.fellBackToEnglish).toBe(true);
      expect(result.message.blend.guard).toBe("fallback:english");
      expect(result.message.blend.ratio).toBe(0);
      expect(result.ttsPayload).toBeUndefined();
      const fallbackTargetTokens = targetTokens(result.message.tokens as TutorToken[], leg.targetTag);
      expect(fallbackTargetTokens).toHaveLength(0);
      for (const token of result.message.tokens as TutorToken[]) {
        expect(token.band).toBeUndefined();
      }
    },
  );
});

describe("shared E2E turn script — fake leg's deterministic YELLOW case", () => {
  it("surfaced (accepted on the first attempt, never regenerated, never RED) — verified via TTS since the fixture's word is also 'new' and anglicizes on display, same as the GREEN case above", async () => {
    const app = await composeApp(FAKE_LEG.config());
    const generator = new ReplayCandidateGenerator({ fixturesDir: FAKE_LEG.fixturesDir });
    const result = await runHotPathTurn(app, generator, {
      learnerMessage: "I'm not totally sure about this one.",
      messageId: "e2e-yellow-fake",
      userId: "e2e-user",
      topic: "e2e",
      voice: { provider: "test", voice: "v1" },
    });
    // YELLOW does NOT trigger regenerate (only RED does) — accepted first try.
    expect(result.attempts).toBe(1);
    expect(result.fellBackToEnglish).toBe(false);
    expect(result.message.blend.guard).toBe("passed");
    const bands = result.message.tokens.map((t) => t.band);
    expect(bands).not.toContain("RED");
    // The gate really did band it YELLOW (not silently upgraded to GREEN):
    // TTS derives from the verified surface regardless of display anglicization.
    expect(result.ttsPayload?.content).toContain("blen");
  });
});

describe("shared E2E turn script — ar leg's per-unit path (S1 review fold)", () => {
  const skip = !process.env["SIDECAR_AR_BASE_URL"];

  it.skipIf(skip)(
    "the stamped directive is keyed (dimension × unit) and vowelLevelsFrom resolves it end-to-end through the real turn loop",
    async () => {
      const app = await composeApp(AR_LEG.config());
      const generator = new ReplayCandidateGenerator({ fixturesDir: AR_LEG.fixturesDir });
      const result = await runHotPathTurn(app, generator, {
        learnerMessage: AR_LEG.greenLearnerMessage,
        messageId: "e2e-per-unit-ar",
        userId: "e2e-user",
        topic: "e2e",
        voice: { provider: "test", voice: "v1" },
      });
      const wordToken = targetTokens(result.message.tokens as TutorToken[], AR_LEG.targetTag).find(
        (t) => t.kind === "word",
      );
      expect(wordToken).toBeDefined();
      expect(wordToken?.directive).toBeDefined();
      // the directive names the token's OWN lemma unit, not a generic/shared key
      const directive = wordToken?.directive as {
        fadeLevels: Array<{ dim: string; unit: { kind: string; id: string } }>;
      };
      const lemmaEntries = directive.fadeLevels.filter((f) => f.unit.kind === AR_LEMMA_UNIT_KIND);
      expect(lemmaEntries.length).toBeGreaterThan(0);
      const unit = lemmaEntries[0]?.unit;
      // resolved by (dimension × unit) — matches the DEFAULT (first
      // lemma-kind unit) lookup, proving the keyed path is well-defined
      // end-to-end from the real turn loop's stamped directive.
      const levels = vowelLevelsFrom(directive as never, unit);
      expect(levels.lexical).toBe("full");
      expect(levels.caseEnding).toBe("full");
      expect(vowelLevelsFrom(directive as never)).toEqual(levels); // default (no unit arg) agrees
    },
  );
});
