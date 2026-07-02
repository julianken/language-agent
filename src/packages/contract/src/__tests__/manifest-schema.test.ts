import { describe, expect, it } from "vitest";
import { PackManifestSchema, parsePackManifest } from "../manifest-schema.js";
import { makeMinimalPack } from "./minimal-pack.js";

describe("PackManifestSchema", () => {
  it("validates a well-formed LanguagePack (AC: manifest validates well-formed)", () => {
    expect(() => parsePackManifest(makeMinimalPack())).not.toThrow();
  });

  it("rejects a manifest missing a port (AC: rejects malformed)", () => {
    const pack = makeMinimalPack() as unknown as Record<string, unknown>;
    delete pack["verificationGate"];
    expect(PackManifestSchema.safeParse(pack).success).toBe(false);
  });

  it("rejects a non-function factory (AC: rejects malformed)", () => {
    const pack = makeMinimalPack() as unknown as Record<string, unknown>;
    pack["ttsDriver"] = "not a function";
    expect(PackManifestSchema.safeParse(pack).success).toBe(false);
  });

  it("rejects an invalid renderer direction", () => {
    const pack = makeMinimalPack();
    (pack.rendererManifest as { direction: string }).direction = "ttb";
    expect(PackManifestSchema.safeParse(pack).success).toBe(false);
  });

  it("rejects a declared `capabilities` field — capabilities are DERIVED, never declared (AC: no capabilities field)", () => {
    const pack = makeMinimalPack() as unknown as Record<string, unknown>;
    pack["capabilities"] = { direction: "ltr" };
    const result = PackManifestSchema.safeParse(pack);
    expect(result.success).toBe(false);
  });

  it("rejects a gating edge referencing an undeclared fade dimension", () => {
    const pack = makeMinimalPack();
    pack.masteryModel.declarations.gatingEdges = [
      { gatingUnitKind: "glyph", gatedDimension: "notDeclared" },
    ];
    expect(PackManifestSchema.safeParse(pack).success).toBe(false);
  });

  it("rejects a gating edge referencing an undeclared unit kind", () => {
    const pack = makeMinimalPack();
    pack.masteryModel.declarations.gatingEdges = [
      { gatingUnitKind: "notAKind", gatedDimension: "glyphHint" },
    ];
    expect(PackManifestSchema.safeParse(pack).success).toBe(false);
  });

  it("rejects a credit-leak edge referencing an undeclared fade dimension", () => {
    const pack = makeMinimalPack();
    pack.masteryModel.declarations.creditLeakEdges = [
      { evidenceDimension: "meaning", leakingDimension: "notDeclared" },
    ];
    expect(PackManifestSchema.safeParse(pack).success).toBe(false);
  });

  it("rejects a credit-leak SELF-edge — same-dimensional protection is the universal half of the leak law, not declarable", () => {
    const pack = makeMinimalPack();
    pack.masteryModel.declarations.creditLeakEdges = [
      { evidenceDimension: "meaning", leakingDimension: "meaning" },
    ];
    const result = PackManifestSchema.safeParse(pack);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toContain("self-edge");
    }
  });

  it("accepts zero declared credit-leak edges (Arabic's shape — universal same-dimensional coverage needs no declaration)", () => {
    const pack = makeMinimalPack();
    pack.masteryModel.declarations.creditLeakEdges = [];
    expect(PackManifestSchema.safeParse(pack).success).toBe(true);
  });

  it("rejects duplicate fade dimensions", () => {
    const pack = makeMinimalPack();
    pack.masteryModel.declarations.fadeDimensions = ["meaning", "meaning"];
    expect(PackManifestSchema.safeParse(pack).success).toBe(false);
  });

  it("names the failing seam in the error (boot-fail-fast with a named-seam error)", () => {
    const pack = makeMinimalPack() as unknown as Record<string, unknown>;
    pack["ttsDriver"] = 42;
    const result = PackManifestSchema.safeParse(pack);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toContain("ttsDriver");
    }
  });
});
