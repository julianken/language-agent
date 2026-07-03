import { describe, expect, it } from "vitest";
import { HAIKU_MODEL, modelParamsFor, SONNET_MODEL } from "../llm/model-params.js";

describe("modelParamsFor — model-appropriate parameter branching (AC: unit-tested)", () => {
  it("claude-sonnet-5 gets adaptive thinking, never budget_tokens", () => {
    const params = modelParamsFor(SONNET_MODEL);
    expect(params.thinking).toEqual({ type: "adaptive" });
    expect(params).not.toHaveProperty("budget_tokens");
  });

  it("claude-haiku-4-5 gets no thinking and no effort key at all", () => {
    const params = modelParamsFor(HAIKU_MODEL);
    expect(params).not.toHaveProperty("thinking");
    expect(params).not.toHaveProperty("effort");
  });

  it("the two branches are genuinely different shapes", () => {
    const sonnet = modelParamsFor(SONNET_MODEL);
    const haiku = modelParamsFor(HAIKU_MODEL);
    expect(sonnet).not.toEqual(haiku);
  });

  it("rejects an unsupported model rather than silently returning an unbranched shape", () => {
    expect(() => modelParamsFor("claude-opus-4-8")).toThrow(/unsupported model/);
  });
});
