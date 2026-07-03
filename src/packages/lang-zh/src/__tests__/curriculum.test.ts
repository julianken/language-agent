import { describe, expect, it } from "vitest";
import { zhCurriculumPolicy } from "../curriculum.js";

function ctx() {
  return {
    sidecar: { baseUrl: "http://127.0.0.1:0" },
    assets: { read: () => Promise.reject(new Error("not used")) },
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    config: {},
    fsrs: {},
  };
}

describe("zhCurriculumPolicy — seed-tuples bypass (mirrors ar's ADR §5.2 #9 pattern: no FSRS-due, no topic ranking)", () => {
  it("candidates() is sourced only from the committed assets/seed-tuples.json known-set", () => {
    const policy = zhCurriculumPolicy.make(ctx());
    const candidates = policy.candidates({ userId: "u1" }, "any-topic");
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(c.unit.kind).toBe("word");
      expect(c.unit.id).toMatch(/^.+:.+$/); // the zhWordUnitRef `word:reading` convention (readingId itself contains a ':')
    }
  });

  it("ignores topic/snapshot entirely — the bypass, by construction", () => {
    const policy = zhCurriculumPolicy.make(ctx());
    const a = policy.candidates({ userId: "u1" }, "topic-a");
    const b = policy.candidates({ userId: "u2" }, "topic-b");
    expect(a).toEqual(b);
  });

  it("declares the default structural floors — NO budget-style dual coverage floor in v0 (see curriculum.ts header: the real §7.3 dual floor is deferred to Phase 3)", () => {
    expect(zhCurriculumPolicy.floors.map((f) => f.id)).toEqual(["nonempty-stream", "green-majority"]);
  });

  it("covers all 58 curated seed tuples", () => {
    const policy = zhCurriculumPolicy.make(ctx());
    const candidates = policy.candidates({ userId: "u1" }, "any-topic");
    expect(candidates.length).toBe(58);
  });
});
