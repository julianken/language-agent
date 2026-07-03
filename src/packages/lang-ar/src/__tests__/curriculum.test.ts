import { describe, expect, it } from "vitest";
import { arCurriculumPolicy } from "../curriculum.js";

function ctx() {
  return {
    sidecar: { baseUrl: "http://127.0.0.1:0" },
    assets: { read: () => Promise.reject(new Error("not used")) },
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    config: {},
    fsrs: {},
  };
}

describe("arCurriculumPolicy — seed-vocab bypass (ADR §5.2 #9: no FSRS-due, no topic ranking)", () => {
  it("candidates() is sourced only from the committed assets/seed-vocab.json known-set", () => {
    const policy = arCurriculumPolicy.make(ctx());
    const candidates = policy.candidates({ userId: "u1" }, "any-topic");
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(c.unit.kind).toBe("lemma");
      expect(c.unit.id).toMatch(/^.+#.+$/); // the arLemmaUnitRef `lemma#gloss` convention
    }
  });

  it("ignores topic/snapshot entirely — the bypass, by construction", () => {
    const policy = arCurriculumPolicy.make(ctx());
    const a = policy.candidates({ userId: "u1" }, "topic-a");
    const b = policy.candidates({ userId: "u2" }, "topic-b");
    expect(a).toEqual(b);
  });

  it("declares the default structural floors", () => {
    expect(arCurriculumPolicy.floors.map((f) => f.id)).toEqual(["nonempty-stream", "green-majority"]);
  });
});
