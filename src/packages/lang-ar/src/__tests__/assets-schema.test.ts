import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AssetManifest } from "@la/contract";
import {
  AR_ASSETS_ROOT,
  ArSeedVocabSchema,
  arAssetManifest,
} from "../assets/index.js";

// Mirrors the Arabic sidecar's dediac round-trip charset
// (src/sidecars/ar/app/dediac_leg.py, camel_tools' AR_DIAC_CHARSET) without
// depending on camel-tools from TS: the harakāt + shadda + superscript
// alef + tanwin marks. Re-implemented narrowly here (test-only) so this
// suite can assert the `dediac(diac) === surface` self-consistency
// invariant without booting the sidecar.
const AR_DIAC_RANGE = /[ً-ْٰ]/g;
const dediac = (s: string): string => s.replace(AR_DIAC_RANGE, "");

async function loadSeedVocab(): Promise<unknown> {
  const raw = await readFile(join(AR_ASSETS_ROOT, "seed-vocab.json"), "utf8");
  return JSON.parse(raw);
}

describe("@la/lang-ar seed-vocab asset (issue #8)", () => {
  it("AR_ASSETS_ROOT resolves to a directory containing seed-vocab.json", async () => {
    const raw = await readFile(join(AR_ASSETS_ROOT, "seed-vocab.json"), "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it("validates against ArSeedVocabSchema (the seam-9 row schema this package authors)", async () => {
    const parsed = ArSeedVocabSchema.safeParse(await loadSeedVocab());
    expect(parsed.success).toBe(true);
  });

  it("ships between 30 and 100 hand-curated entries (issue #8 scope)", async () => {
    const rows = ArSeedVocabSchema.parse(await loadSeedVocab());
    expect(rows.length).toBeGreaterThanOrEqual(30);
    expect(rows.length).toBeLessThanOrEqual(100);
  });

  it("covers both tier-0 and tier-1 (docs/plans/vocabulary-system.md §2 Q4)", async () => {
    const rows = ArSeedVocabSchema.parse(await loadSeedVocab());
    const byTier = new Map<string, number>();
    for (const row of rows) byTier.set(row.tier, (byTier.get(row.tier) ?? 0) + 1);
    expect(byTier.get("tier-0")).toBeGreaterThan(0);
    expect(byTier.get("tier-1")).toBeGreaterThan(0);
  });

  it("every row's lexemeId and senseId are unique", async () => {
    const rows = ArSeedVocabSchema.parse(await loadSeedVocab());
    expect(new Set(rows.map((r) => r.lexemeId)).size).toBe(rows.length);
    expect(new Set(rows.map((r) => r.senseId)).size).toBe(rows.length);
  });

  it("every row's `surface` is exactly the dediacritized `diac` (leg-1 self-consistency, cheaply, without booting the sidecar)", async () => {
    const rows = ArSeedVocabSchema.parse(await loadSeedVocab());
    for (const row of rows) {
      expect(dediac(row.diac), `lexemeId=${row.lexemeId}`).toBe(row.surface);
    }
  });
});

describe("@la/lang-ar seam-9 boot-validation compatibility (issue #8 AC4)", () => {
  // This package does not yet ship a full LanguagePack (that is #9/#10/#11's
  // wiring) so it cannot import `src/apps/server`'s `assertAssetsPresent`
  // without an illegal app->package dependency direction. Instead this
  // replicates that function's exact logic (boot.ts: stat the file, JSON.parse
  // it, `spineSchema.safeParse` it) against the REAL exported
  // `arAssetManifest` + `AR_ASSETS_ROOT`, proving the shape #16's boot path
  // will exercise once a pack wires this manifest in.
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

  it("arAssetManifest declares the seedVocab asset with this package's row schema", () => {
    expect(Object.keys(arAssetManifest.assets)).toEqual(["seedVocab"]);
    expect(arAssetManifest.assets["seedVocab"]?.path).toBe("seed-vocab.json");
    expect(arAssetManifest.assets["seedVocab"]?.spineSchema).toBe(ArSeedVocabSchema);
  });

  it("passes the boot-validation shape (existence + spine-schema validity) against AR_ASSETS_ROOT", async () => {
    await expect(assertAssetsPresentLike(arAssetManifest, AR_ASSETS_ROOT)).resolves.toBeUndefined();
  });

  it("fails the boot-validation shape the same way a missing asset would (negative control)", async () => {
    const emptyRoot = await mkdtemp(join(tmpdir(), "la-lang-ar-assets-"));
    await expect(assertAssetsPresentLike(arAssetManifest, emptyRoot)).rejects.toThrow(/ENOENT|no such file/);
  });

  it("fails the boot-validation shape on a spine-schema-invalid asset (negative control)", async () => {
    const root = await mkdtemp(join(tmpdir(), "la-lang-ar-assets-"));
    await writeFile(join(root, "seed-vocab.json"), JSON.stringify([{ bogus: 1 }]));
    await expect(assertAssetsPresentLike(arAssetManifest, root)).rejects.toThrow(
      /asset 'seedVocab' fails its declared spine schema/,
    );
  });
});
