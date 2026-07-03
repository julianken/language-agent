/**
 * AC coverage: "composeApp boots successfully end-to-end against
 * @la/lang-fake: registry resolves, contractVersion equality assert
 * passes, manifest parses, deriveCapabilities runs, and asset existence +
 * spine-schema validation passes" — plus the named-seam boot-failure
 * paths.
 */

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTRACT_VERSION, type LanguagePack } from "@la/contract";
import { FAKE_ASSETS_ROOT, pack as fakePack } from "@la/lang-fake";
import { AR_ASSETS_ROOT } from "@la/lang-ar/assets";
import { composeApp } from "../composeApp.js";
import { parseInstanceConfig, type InstanceConfig } from "../config.js";
import {
  assertAssetsPresent,
  assertContractVersionEqual,
  makeAssetReader,
} from "../boot.js";

const SIDECAR_AR_BASE_URL = process.env["SIDECAR_AR_BASE_URL"];

const fakeConfig = (): InstanceConfig =>
  parseInstanceConfig({
    language: "fake",
    sidecar: { baseUrl: "http://127.0.0.1:9999", mode: "mock" },
    assetsRoot: FAKE_ASSETS_ROOT,
    tts: { provider: "fake", voice: "v1" },
  });

/** `composeApp` never queries the sidecar at boot (`assertSidecarAgrees`'s
 * live `/v1/capabilities` cross-check is not yet wired — a pre-existing gap,
 * not introduced here) — a placeholder base URL is fine for the pure BOOT
 * assertions below; only the gate-verification test needs the real one. */
const arConfig = (): InstanceConfig =>
  parseInstanceConfig({
    language: "ar",
    sidecar: { baseUrl: SIDECAR_AR_BASE_URL ?? "http://127.0.0.1:9999", mode: "real" },
    assetsRoot: AR_ASSETS_ROOT,
    tts: { provider: "ar", voice: "v1" },
  });

describe("composeApp — end-to-end boot against @la/lang-fake (AC 6)", () => {
  it("boots: registry resolves, version assert passes, manifest parses, capabilities derive, assets validate", async () => {
    const app = await composeApp(fakeConfig());
    expect(app.lang).toBe("fake");
    expect(app.meta.contractVersion).toBe(CONTRACT_VERSION);
    expect(app.capabilities).toMatchObject({
      direction: "ltr",
      masteryUnitKinds: ["word", "glyph"],
      fadeDimensions: ["meaning", "glyphHint", "stressMark"],
      gatingEdges: [{ gatingUnitKind: "glyph", gatedDimension: "glyphHint" }],
      creditLeakEdges: [
        { evidenceDimension: "meaning", leakingDimension: "glyphHint" },
      ],
      requiredDataAssets: ["lexicon", "segmentation-table"],
    });
  });

  it("the booted app's gate verifies text end-to-end (factories really received the PackContext)", async () => {
    const app = await composeApp(fakeConfig());
    const tokens = await app.ports.verificationGate.verify(
      { targetText: "wug bo zip qux", intents: [] },
      { turnId: "boot-e2e" },
    );
    // Re-segmentation, banding, and asset-backed lexicon all live: the
    // merged token is GREEN, the out-of-world chunk is RED.
    expect(tokens.map((t) => [t.spine.surface, t.band])).toEqual([
      ["wug bo", "GREEN"],
      ["zip", "GREEN"],
      ["qux", "RED"],
    ]);
  });

  it("the booted app's TTS accepts only the verified stream (seam-7 wiring)", async () => {
    const app = await composeApp(fakeConfig());
    const verified = await app.ports.verificationGate.verify(
      { targetText: "zip zap", intents: [] },
      { turnId: "boot-tts" },
    );
    const payload = await app.ports.ttsDriver.synthesize(verified, {
      provider: "fake",
      voice: "v1",
    });
    expect(payload.content).toBe("fake/v1: zip zap");
  });

  it("`zh` registry stub throws the named boot failure (flips to a real import in #21)", async () => {
    await expect(
      composeApp({ ...fakeConfig(), language: "zh" }),
    ).rejects.toThrow(/lang-zh.*#21/s);
  });
});

describe("composeApp — end-to-end boot against the real @la/lang-ar (issue #9's registry flip)", () => {
  it("boots: registry resolves the REAL import, version assert passes, manifest parses, capabilities derive, assets validate", async () => {
    const app = await composeApp(arConfig());
    expect(app.lang).toBe("ar");
    expect(app.meta.contractVersion).toBe(CONTRACT_VERSION);
    expect(app.capabilities).toMatchObject({
      direction: "rtl",
      masteryUnitKinds: ["lemma"],
      fadeDimensions: ["englishBlend", "vowelFadeLexical", "vowelFadeCaseEnding"],
      gatingEdges: [],
      creditLeakEdges: [],
      requiredDataAssets: ["seedVocab"],
    });
  });

  it("the booted app's TTS accepts only the verified stream (seam-7 wiring)", async () => {
    const app = await composeApp(arConfig());
    const verified = [
      {
        spine: { id: "t1", lang: "ar" as const, surface: "كَتَبَ", kind: "word", status: "new", band: "GREEN" as const },
        band: "GREEN" as const,
        evidence: [],
        annotations: {
          diac: "كَتَبَ",
          skeleton: "كتب",
          vowelState: "full" as const,
          morphology: { lemma: "كَتَب", root: "ك.ت.ب", pattern: "1َ2َ3َ", pos: "verb", gloss: "write" },
        },
      },
    ];
    const payload = await app.ports.ttsDriver.synthesize(verified, { provider: "ar", voice: "v1" });
    expect(payload.content).toBe("ar/v1: كَتَبَ");
  });

  it.skipIf(!SIDECAR_AR_BASE_URL)(
    "the booted app's gate verifies text end-to-end through the REAL sidecar (factories really received the PackContext)",
    async () => {
      const app = await composeApp(arConfig());
      const tokens = await app.ports.verificationGate.verify(
        { targetText: "كَتَبَ", intents: [{ id: "i1", description: "write" }] },
        { turnId: "boot-e2e-ar" },
      );
      expect(tokens.map((t) => [t.spine.surface, t.band])).toEqual([["كَتَبَ", "GREEN"]]);
    },
  );
});

describe("boot validation — named-seam failures", () => {
  it("contractVersion mismatch is a boot failure naming the meta seam", () => {
    const skewed: LanguagePack = {
      ...(fakePack as LanguagePack),
      meta: { ...fakePack.meta, contractVersion: "999.0.0" },
    };
    expect(() => assertContractVersionEqual(skewed)).toThrow(
      /boot failure \[meta\].*999\.0\.0/s,
    );
  });

  it("a missing asset is a boot failure naming the assetManifest seam", async () => {
    const emptyRoot = await mkdtemp(join(tmpdir(), "la-assets-"));
    await expect(
      assertAssetsPresent(fakePack.assetManifest, emptyRoot),
    ).rejects.toThrow(/boot failure \[assetManifest\].*'lexicon' missing/s);
  });

  it("a spine-schema-invalid asset is a boot failure naming the asset", async () => {
    const root = await mkdtemp(join(tmpdir(), "la-assets-"));
    await writeFile(join(root, "lexicon.json"), JSON.stringify([{ bogus: 1 }]));
    await writeFile(
      join(root, "segmentation-table.json"),
      JSON.stringify({ merges: [], splits: [], spanPairs: [] }),
    );
    await expect(
      assertAssetsPresent(fakePack.assetManifest, root),
    ).rejects.toThrow(/asset 'lexicon' fails its declared spine schema/);
  });

  it("instance config parsing rejects an unknown language before composeApp runs", () => {
    expect(() =>
      parseInstanceConfig({
        language: "klingon",
        sidecar: { baseUrl: "http://127.0.0.1:9999" },
        assetsRoot: FAKE_ASSETS_ROOT,
        tts: { provider: "fake", voice: "v1" },
      }),
    ).toThrow();
  });
});

describe("scoped asset reader", () => {
  it("resolves only ids declared in the pack's manifest", async () => {
    const reader = makeAssetReader(fakePack.assetManifest, FAKE_ASSETS_ROOT);
    await expect(reader.read("lexicon")).resolves.toBeInstanceOf(Array);
    await expect(reader.read("not-declared")).rejects.toThrow(
      /not declared in this pack's assetManifest/,
    );
  });
});
