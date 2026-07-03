import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ReplayCandidateGenerator } from "../llm/replay-client.js";

const FAKE_FIXTURES_DIR = fileURLToPath(new URL("../../fixtures/llm-replay/fake/", import.meta.url));

describe("ReplayCandidateGenerator", () => {
  it("returns the recorded attempt for a known learnerMessage, never touching the network", async () => {
    const generator = new ReplayCandidateGenerator({ fixturesDir: FAKE_FIXTURES_DIR });
    const candidates = await generator.generate({
      learnerMessage: "Tell me about zip zap zorg.",
      plan: { intents: [] },
      constraints: { instructions: [] },
      n: 1,
    });
    expect(candidates).toEqual([{ text: "zip zap zorg" }]);
  });

  it("advances to the next recorded attempt on each subsequent call for the SAME learnerMessage (regenerate path)", async () => {
    const generator = new ReplayCandidateGenerator({ fixturesDir: FAKE_FIXTURES_DIR });
    const args = {
      learnerMessage: "Something with a tricky word.",
      plan: { intents: [] },
      constraints: { instructions: [] },
      n: 1,
    };
    const first = await generator.generate(args);
    const second = await generator.generate(args);
    expect(first).toEqual([{ text: "zip qux" }]);
    expect(second).toEqual([{ text: "zip zap zorg" }]);
  });

  it("repeats the LAST recorded attempt once calls exceed the recorded count", async () => {
    const generator = new ReplayCandidateGenerator({ fixturesDir: FAKE_FIXTURES_DIR });
    const args = {
      learnerMessage: "This one always fails verification.",
      plan: { intents: [] },
      constraints: { instructions: [] },
      n: 1,
    };
    const results = [];
    for (let i = 0; i < 5; i += 1) results.push(await generator.generate(args));
    expect(results.every((r) => r[0]?.text === "qux")).toBe(true);
  });

  it("throws a clear error for an unrecorded learnerMessage", async () => {
    const generator = new ReplayCandidateGenerator({ fixturesDir: FAKE_FIXTURES_DIR });
    await expect(
      generator.generate({
        learnerMessage: "never recorded",
        plan: { intents: [] },
        constraints: { instructions: [] },
        n: 1,
      }),
    ).rejects.toThrow(/no authored fixture/);
  });
});
