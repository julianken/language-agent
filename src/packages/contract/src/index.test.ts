import { describe, expect, it } from "vitest";
import { CONTRACT_PLACEHOLDER } from "./index.js";

// The one trivial passing test the scaffold needs so CI's test stage is real
// (issue #6 AC: "test runner minimal — one trivial passing test"). Every
// other package in the workspace runs `vitest run --passWithNoTests`; real
// suites land with each package's real content (#16, #7, #9, #17, ...).
describe("workspace scaffold", () => {
  it("resolves the @la/contract placeholder export", () => {
    expect(CONTRACT_PLACEHOLDER).toBe(true);
  });
});
