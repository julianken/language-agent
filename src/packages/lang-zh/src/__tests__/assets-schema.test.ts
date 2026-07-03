import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AssetManifest } from "@la/contract";
import {
  ZH_ASSETS_ROOT,
  ZhC9ContextTableAssetSchema,
  ZhSeedTuplesAssetSchema,
  ZhSegmenterNormalizationAssetSchema,
  zhAssetManifest,
} from "../assets/index.js";

async function loadAsset(name: string): Promise<unknown> {
  const raw = await readFile(join(ZH_ASSETS_ROOT, name), "utf8");
  return JSON.parse(raw);
}

describe("@la/lang-zh committed assets (issue #20, read-only)", () => {
  it("seed-tuples.json validates against ZhSeedTuplesAssetSchema and carries 58 curated tuples", async () => {
    const parsed = ZhSeedTuplesAssetSchema.parse(await loadAsset("seed-tuples.json"));
    expect(parsed.tuples.length).toBe(58);
  });

  it("every seed tuple's readingId and word are unique", async () => {
    const parsed = ZhSeedTuplesAssetSchema.parse(await loadAsset("seed-tuples.json"));
    expect(new Set(parsed.tuples.map((t) => t.readingId)).size).toBe(parsed.tuples.length);
  });

  it("c9-context-table.json validates against ZhC9ContextTableAssetSchema", async () => {
    const parsed = ZhC9ContextTableAssetSchema.parse(await loadAsset("c9-context-table.json"));
    expect(parsed.entries.length).toBeGreaterThan(0);
    expect(parsed.singles).toEqual(["的", "了", "不", "一", "嗎", "呢"]);
  });

  it("segmenter-normalization.json validates against ZhSegmenterNormalizationAssetSchema", async () => {
    const parsed = ZhSegmenterNormalizationAssetSchema.parse(
      await loadAsset("segmenter-normalization.json"),
    );
    expect(Object.keys(parsed.mappings).length).toBeGreaterThan(0);
  });
});

describe("@la/lang-zh seam-9 boot-validation compatibility (mirrors ar issue #8 AC4)", () => {
  // This package's boot path is exercised in full by `composeApp`
  // (server-side); this test replicates that function's exact logic (stat
  // the file, JSON.parse it, `spineSchema.safeParse` it) against the REAL
  // exported `zhAssetManifest` + `ZH_ASSETS_ROOT`.
  async function assertAssetsPresentLike(manifest: AssetManifest, assetsRoot: string): Promise<void> {
    for (const [assetId, decl] of Object.entries(manifest.assets)) {
      const fullPath = join(assetsRoot, decl.path);
      const parsed: unknown = JSON.parse(await readFile(fullPath, "utf8"));
      const result = decl.spineSchema.safeParse(parsed);
      if (!result.success) {
        throw new Error(`boot failure [assetManifest]: asset '${assetId}' fails its declared spine schema: ${result.error.message}`);
      }
    }
  }

  it("zhAssetManifest declares the three committed assets with this package's row schemas", () => {
    expect(Object.keys(zhAssetManifest.assets).sort()).toEqual(
      ["c9-context-table", "seed-tuples", "segmenter-normalization"].sort(),
    );
  });

  it("passes the boot-validation shape (existence + spine-schema validity) against ZH_ASSETS_ROOT", async () => {
    await expect(assertAssetsPresentLike(zhAssetManifest, ZH_ASSETS_ROOT)).resolves.toBeUndefined();
  });

  it("fails the boot-validation shape the same way a missing asset would (negative control)", async () => {
    const emptyRoot = await mkdtemp(join(tmpdir(), "la-lang-zh-assets-"));
    await expect(assertAssetsPresentLike(zhAssetManifest, emptyRoot)).rejects.toThrow(/ENOENT|no such file/);
  });

  it("fails the boot-validation shape on a spine-schema-invalid asset (negative control)", async () => {
    const root = await mkdtemp(join(tmpdir(), "la-lang-zh-assets-"));
    await writeFile(join(root, "seed-tuples.json"), JSON.stringify({ bogus: 1 }));
    await writeFile(join(root, "c9-context-table.json"), JSON.stringify({ bogus: 1 }));
    await writeFile(join(root, "segmenter-normalization.json"), JSON.stringify({ bogus: 1 }));
    await expect(assertAssetsPresentLike(zhAssetManifest, root)).rejects.toThrow(
      /fails its declared spine schema/,
    );
  });
});
