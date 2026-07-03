/**
 * The tokens.json bridge is faithful to DESIGN.md §0 (tokens.json is §0's
 * machine mirror, so these literals double as a conformance spot-check)
 * and structurally complete for the vars components bind to.
 */

import { describe, expect, it } from "vitest";
import { computeCssVars } from "../applyTokens.js";

describe("computeCssVars", () => {
  const vars = computeCssVars();

  it("resolves semantic color aliases to the DESIGN.md §0 literals", () => {
    expect(vars["--la-color-primary"]).toBe("#0f766e");
    expect(vars["--la-color-canvas"]).toBe("#fbf9f4");
    expect(vars["--la-color-ink"]).toBe("#1a1612");
    expect(vars["--la-color-english-recede"]).toBe("#a79e8e");
    expect(vars["--la-color-status-new-bg"]).toBe("#f6ecd2");
    expect(vars["--la-color-status-learning-bg"]).toBe("#dcebe8");
    expect(vars["--la-color-confidence-uncertain"]).toBe("#c08a2e");
    expect(vars["--la-color-correction-remove"]).toBe("#b5654a");
  });

  it("resolves the subject reading ramp (arabic-reading-lg: 27px / 1.95)", () => {
    expect(vars["--la-type-subject-reading-lg-size"]).toBe("27px");
    expect(vars["--la-type-subject-reading-lg-line-height"]).toBe("1.95");
    expect(vars["--la-locale-subject-leading"]).toBe("1.95");
    expect(vars["--la-font-subject-family"]).toBe('"Amiri"');
  });

  it("builds the single soft-card shadow tier from the shadow token", () => {
    expect(vars["--la-shadow-soft-card"]).toBe(
      "0px 8px 24px 0px rgba(26, 22, 18, 0.12)",
    );
  });

  it("never emits a direction variable (structural, pack-owned — ADR §1.4)", () => {
    expect(
      Object.keys(vars).filter((k) => k.includes("direction")),
    ).toEqual([]);
  });
});
