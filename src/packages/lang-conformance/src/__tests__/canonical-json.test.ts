import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  canonicalJson,
  isOrderedSubsequence,
  multisetSubsetViolation,
} from "../canonical-json.js";

describe("canonicalJson", () => {
  it("serializes structurally-equal values identically regardless of key order", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(
      canonicalJson({ a: { c: 3, d: 2 }, b: 1 }),
    );
  });

  it("preserves array order (arrays are sequences, not sets)", () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });

  it("round-trips arbitrary JSON values stably (property)", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        const once = canonicalJson(value);
        expect(canonicalJson(JSON.parse(once))).toBe(once);
      }),
    );
  });
});

describe("multisetSubsetViolation", () => {
  it("accepts genuine sub-multisets and rejects overdraws", () => {
    expect(multisetSubsetViolation(["a", "b"], ["b", "a", "a"])).toBeUndefined();
    expect(multisetSubsetViolation(["a", "a"], ["a", "b"])).toBe("a");
    expect(multisetSubsetViolation(["z"], ["a", "b"])).toBe("z");
    expect(multisetSubsetViolation([], [])).toBeUndefined();
  });
});

describe("isOrderedSubsequence", () => {
  it("verifies relative order", () => {
    expect(isOrderedSubsequence(["a", "c"], ["a", "b", "c"])).toBe(true);
    expect(isOrderedSubsequence(["c", "a"], ["a", "b", "c"])).toBe(false);
    expect(isOrderedSubsequence([], ["a"])).toBe(true);
    expect(isOrderedSubsequence(["a", "a"], ["a", "b", "a"])).toBe(true);
    expect(isOrderedSubsequence(["a", "a"], ["a", "b"])).toBe(false);
  });
});
