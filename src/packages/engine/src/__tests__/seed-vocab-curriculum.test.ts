import { describe, expect, it } from "vitest";
import { makeSeedVocabBypassCurriculum } from "../seed-vocab-curriculum.js";

interface Row {
  lemma: string;
  gloss: string;
}

const ROWS: Row[] = [
  { lemma: "كَتَبَ", gloss: "write" },
  { lemma: "بَيْت", gloss: "house" },
];

describe("makeSeedVocabBypassCurriculum", () => {
  const factory = makeSeedVocabBypassCurriculum<Row>({
    loadRows: () => ROWS,
    rowToUnit: (row) => ({ kind: "lemma", id: `${row.lemma}#${row.gloss}` }),
  });

  it("declares the default structural floors (nonempty-stream, green-majority)", () => {
    expect(factory.floors.map((f) => f.id)).toEqual(["nonempty-stream", "green-majority"]);
  });

  it("candidates() is sourced ONLY from the seed-vocab rows — no ranking, no FSRS/topic input", () => {
    const policy = factory.make({
      sidecar: { baseUrl: "http://127.0.0.1:0" },
      assets: { read: () => Promise.reject(new Error("not used")) },
      logger: { debug() {}, info() {}, warn() {}, error() {} },
      config: {},
      fsrs: {},
    });
    const a = policy.candidates({ userId: "u1" }, "any-topic");
    const b = policy.candidates({ userId: "u2" }, "a-completely-different-topic");
    expect(a).toEqual(b); // topic/snapshot are ignored — the bypass, by construction
    expect(a).toEqual([
      { unit: { kind: "lemma", id: "كَتَبَ#write" } },
      { unit: { kind: "lemma", id: "بَيْت#house" } },
    ]);
  });

  it("the instance re-carries the factory's own floors (one source)", () => {
    const policy = factory.make({
      sidecar: { baseUrl: "http://127.0.0.1:0" },
      assets: { read: () => Promise.reject(new Error("not used")) },
      logger: { debug() {}, info() {}, warn() {}, error() {} },
      config: {},
      fsrs: {},
    });
    expect(policy.floors).toBe(factory.floors);
  });

  it("green-majority floor and nonempty-stream floor behave over a candidate token stream", () => {
    const floors = factory.floors;
    const green = floors.find((f) => f.id === "green-majority");
    const nonempty = floors.find((f) => f.id === "nonempty-stream");
    const snapshot = { userId: "u1" };
    expect(nonempty?.satisfied([], snapshot)).toBe(false);
    const stream = [
      { id: "t1", lang: "ar" as const, surface: "a", kind: "word", status: "new", band: "GREEN" as const },
      { id: "t2", lang: "ar" as const, surface: "b", kind: "word", status: "new", band: "RED" as const },
    ];
    expect(green?.satisfied(stream, snapshot)).toBe(true); // 1/2 GREEN — exactly at the 50% inclusive bar
  });
});
