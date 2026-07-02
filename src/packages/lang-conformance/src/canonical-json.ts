/**
 * Canonical JSON serialization — object keys sorted recursively — so two
 * structurally-equal values always serialize identically regardless of how
 * a pack ordered its keys. The laws use it for multiset/subsequence token
 * identity (subtraction-safety, frame preservation) where reference
 * equality would be an over-assumption and insertion-order JSON would be
 * an under-assumption.
 *
 * Input domain: JSON-shaped data only (the values compared are either
 * contract spines — plain string/enum fields — or pack codec `encode`
 * output, which the annotation-validity law already requires to be
 * JSON-round-trippable).
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([k, v]) => [k, sortKeysDeep(v)]));
  }
  return value;
}

/** Multiset containment: every key of `sub` occurs in `all` at least as
 * many times. Returns the first violating key, or undefined when ⊆ holds. */
export function multisetSubsetViolation(
  sub: string[],
  all: string[],
): string | undefined {
  const counts = new Map<string, number>();
  for (const key of all) counts.set(key, (counts.get(key) ?? 0) + 1);
  for (const key of sub) {
    const left = counts.get(key) ?? 0;
    if (left === 0) return key;
    counts.set(key, left - 1);
  }
  return undefined;
}

/** Whether `sub` is an ordered subsequence of `all`. */
export function isOrderedSubsequence(sub: string[], all: string[]): boolean {
  let i = 0;
  for (const key of all) {
    if (i < sub.length && key === sub[i]) i += 1;
  }
  return i === sub.length;
}
