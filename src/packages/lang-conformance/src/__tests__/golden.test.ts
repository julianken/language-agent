/**
 * Golden-fixture loader unit tests: the loader must reject malformed
 * corpora loudly (naming the offending file) and load well-formed cases in
 * stable (sorted-filename) order.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { floorsShouldHold, loadGoldenCases } from "../golden.js";

const dirs: string[] = [];

function corpusDir(files: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), "tck-golden-"));
  dirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(
      join(dir, name),
      typeof content === "string" ? content : JSON.stringify(content, null, 2),
    );
  }
  return dir;
}

afterEach(() => {
  while (dirs.length > 0) {
    const dir = dirs.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

const VALID_CASE = {
  name: "a valid case",
  targetText: "zip",
  intents: [{ id: "i1", description: "say one" }],
  expected: {
    tokens: [{ surface: "zip", band: "GREEN" }],
    annotations: [{ lexemeId: "zip" }],
  },
};

describe("loadGoldenCases", () => {
  it("loads cases sorted by filename and stamps ids from basenames", () => {
    const dir = corpusDir({
      "b-second.json": { ...VALID_CASE, name: "second" },
      "a-first.json": { ...VALID_CASE, name: "first" },
      "notes.txt": "ignored — not a .json case",
    });
    const cases = loadGoldenCases(dir);
    expect(cases.map((c) => c.id)).toEqual(["a-first", "b-second"]);
    expect(cases.map((c) => c.name)).toEqual(["first", "second"]);
    expect(cases[0]?.intents).toEqual([{ id: "i1", description: "say one" }]);
  });

  it("rejects an empty corpus", () => {
    const dir = corpusDir({});
    expect(() => loadGoldenCases(dir)).toThrow(/empty/);
  });

  it("rejects invalid JSON, naming the file", () => {
    const dir = corpusDir({ "broken.json": "{ not json" });
    expect(() => loadGoldenCases(dir)).toThrow(/broken\.json/);
  });

  it("rejects a case with a missing targetText", () => {
    const dir = corpusDir({
      "bad.json": { ...VALID_CASE, targetText: "" },
    });
    expect(() => loadGoldenCases(dir)).toThrow(/targetText/);
  });

  it("rejects annotations misaligned with tokens", () => {
    const dir = corpusDir({
      "bad.json": {
        ...VALID_CASE,
        expected: { ...VALID_CASE.expected, annotations: [] },
      },
    });
    expect(() => loadGoldenCases(dir)).toThrow(/align/);
  });

  it("rejects an unknown band", () => {
    const dir = corpusDir({
      "bad.json": {
        ...VALID_CASE,
        expected: {
          ...VALID_CASE.expected,
          tokens: [{ surface: "zip", band: "PURPLE" }],
        },
      },
    });
    expect(() => loadGoldenCases(dir)).toThrow(/band/);
  });
});

describe("floorsShouldHold", () => {
  it("defaults to true only when every expected band is GREEN", () => {
    const dir = corpusDir({
      "green.json": VALID_CASE,
      "red.json": {
        ...VALID_CASE,
        expected: {
          tokens: [{ surface: "qux", band: "RED" }],
          annotations: [{}],
        },
      },
      "red-but-winner.json": {
        ...VALID_CASE,
        expected: {
          tokens: [{ surface: "qux", band: "RED" }],
          annotations: [{}],
          floorsHold: true,
        },
      },
    });
    // Sorted filename order: green.json, red-but-winner.json, red.json.
    const [green, redWinner, red] = loadGoldenCases(dir);
    expect(green && floorsShouldHold(green)).toBe(true);
    expect(red && floorsShouldHold(red)).toBe(false);
    expect(redWinner && floorsShouldHold(redWinner)).toBe(true);
  });
});
