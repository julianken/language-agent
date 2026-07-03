import { describe, expect, it } from "vitest";
import { AnthropicCandidateGenerator } from "../llm/anthropic-client.js";
import { ReplayCandidateGenerator } from "../llm/replay-client.js";
import { selectCandidateGenerator } from "../llm/select-generator.js";

describe("selectCandidateGenerator — live-generation boot mode (issue #11 PR2)", () => {
  it("selects AnthropicCandidateGenerator when ANTHROPIC_API_KEY is present — construction only, never a live call", () => {
    const generator = selectCandidateGenerator({
      anthropicApiKey: "sk-ant-test-fake-key-not-real",
      fixturesDir: "/nonexistent/never-read-on-this-branch",
    });
    expect(generator).toBeInstanceOf(AnthropicCandidateGenerator);
    expect(generator).not.toBeInstanceOf(ReplayCandidateGenerator);
  });

  it("falls back to ReplayCandidateGenerator when ANTHROPIC_API_KEY is absent", () => {
    const generator = selectCandidateGenerator({
      anthropicApiKey: undefined,
      fixturesDir: "/nonexistent/unused-in-this-construction-only-test",
    });
    expect(generator).toBeInstanceOf(ReplayCandidateGenerator);
    expect(generator).not.toBeInstanceOf(AnthropicCandidateGenerator);
  });

  it("falls back to ReplayCandidateGenerator when ANTHROPIC_API_KEY is an empty or whitespace-only string", () => {
    for (const anthropicApiKey of ["", "   "]) {
      const generator = selectCandidateGenerator({
        anthropicApiKey,
        fixturesDir: "/nonexistent/unused-in-this-construction-only-test",
      });
      expect(generator).toBeInstanceOf(ReplayCandidateGenerator);
    }
  });
});
