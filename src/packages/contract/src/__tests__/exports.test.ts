/**
 * AC coverage: "All nine ports from ADR §1.3 are typed and exported from
 * @la/contract"; "`CreditLeakEdge` is exported alongside `GatingEdge`";
 * "`TokenSpine` includes an optional `spanGroup`; `LearningEvent` and
 * `ScaffoldDirective` (with the `FadeLevel` enum) are exported"; the
 * text-in/tokens-out `verify` signature.
 *
 * Interfaces erase at runtime, so type exports are proven the only way
 * they can be: by USING each one in a value this file compiles against.
 * Runtime exports (CONTRACT_VERSION, PackManifestSchema,
 * deriveCapabilities, unitKey) are asserted directly.
 */

import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import * as contract from "../index.js";
import type {
  AnnotationCodec,
  AssetManifest,
  CreditLeakEdge,
  CurriculumPolicy,
  FadeLevel,
  GatingEdge,
  LanguagePack,
  LearningEvent,
  MasteryModel,
  RendererManifest,
  ScaffoldDirective,
  SidecarDescriptor,
  SteeringPolicy,
  TokenSpine,
  TtsDriver,
  TurnContext,
  TurnIntent,
  VerificationGate,
  VerifiedToken,
} from "../index.js";
import { makeMinimalPack } from "./minimal-pack.js";

describe("@la/contract exports", () => {
  it("exports the runtime surface", () => {
    expect(typeof contract.CONTRACT_VERSION).toBe("string");
    expect(typeof contract.deriveCapabilities).toBe("function");
    expect(typeof contract.parsePackManifest).toBe("function");
    expect(typeof contract.unitKey).toBe("function");
    expect(contract.PackManifestSchema).toBeInstanceOf(z.ZodType);
  });

  it("unitKey encodes a UnitRef canonically", () => {
    expect(contract.unitKey({ kind: "word", id: "zip" })).toBe("word/zip");
  });

  it("types all nine ports (compile-time proof by use)", () => {
    const pack: LanguagePack = makeMinimalPack();
    // Seams 1, 2, 4, 5, 7 are factories; 3, 6, 8, 9 are plain data.
    const ctx: contract.PackContext = {
      sidecar: { baseUrl: "http://127.0.0.1:0" },
      assets: { read: async () => [] },
      logger: {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      config: {},
      fsrs: {},
    };
    const gate: VerificationGate = pack.verificationGate(ctx); // 1
    const steering: SteeringPolicy = pack.steeringPolicy(ctx); // 2
    const codec: AnnotationCodec = pack.annotationCodec; // 3
    const mastery: MasteryModel = pack.masteryModel.make(ctx); // 4
    const curriculum: CurriculumPolicy = pack.curriculumPolicy.make(ctx); // 5
    const renderer: RendererManifest = pack.rendererManifest; // 6
    const tts: TtsDriver = pack.ttsDriver(ctx); // 7
    const sidecar: SidecarDescriptor = pack.sidecarDescriptor; // 8
    const assets: AssetManifest = pack.assetManifest; // 9
    expect([gate, steering, codec, mastery, curriculum, renderer, tts, sidecar, assets]).toHaveLength(9);
  });

  it("pins the text-in/tokens-out verify signature (AC 3)", () => {
    const gate: VerificationGate = makeMinimalPack().verificationGate({
      sidecar: { baseUrl: "http://127.0.0.1:0" },
      assets: { read: async () => [] },
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
      config: {},
      fsrs: {},
    });
    // Parameters are (candidate: {targetText, intents}, ctx) — TEXT in...
    expectTypeOf(gate.verify).parameter(0).toEqualTypeOf<{
      targetText: string;
      intents: TurnIntent[];
    }>();
    expectTypeOf(gate.verify).parameter(1).toEqualTypeOf<TurnContext>();
    // ...banded TOKENS out.
    expectTypeOf(gate.verify).returns.toEqualTypeOf<
      Promise<VerifiedToken[]>
    >();
  });

  it("TokenSpine.spanGroup is optional (AC 4)", () => {
    const withoutSpan: TokenSpine = {
      id: "t1",
      lang: "fake",
      surface: "zip",
      kind: "word",
      status: "new",
      band: "GREEN",
    };
    const withSpan: TokenSpine = { ...withoutSpan, spanGroup: "sg:1" };
    expect(withSpan.spanGroup).toBe("sg:1");
    expect(withoutSpan.spanGroup).toBeUndefined();
  });

  it("exports LearningEvent with the renderedScaffold echo and ScaffoldDirective with FadeLevel (AC 4)", () => {
    const level: FadeLevel = "partial";
    const directive: ScaffoldDirective = {
      fadeLevels: [{ dim: "meaning", unit: { kind: "word", id: "zip" }, level }],
      blend: { anglicize: false },
      dueness: { dueNow: false },
    };
    const event: LearningEvent = {
      tokenRef: "t1",
      unitRefs: [{ kind: "word", id: "zip" }],
      renderedScaffold: { meaning: "hidden", glyphHint: "shown" },
      payload: { schemaId: "fake-events/v1" },
    };
    expectTypeOf(event.renderedScaffold).toEqualTypeOf<
      Record<string, "shown" | "hidden">
    >();
    expect(directive.fadeLevels[0]?.level).toBe("partial");
    expect(event.renderedScaffold["glyphHint"]).toBe("shown");
  });

  it("exports CreditLeakEdge alongside GatingEdge (AC 8)", () => {
    const gating: GatingEdge = {
      gatingUnitKind: "glyph",
      gatedDimension: "glyphHint",
    };
    const leak: CreditLeakEdge = {
      evidenceDimension: "meaning",
      leakingDimension: "glyphHint",
    };
    expect(gating.gatedDimension).toBe(leak.leakingDimension);
  });
});
