/**
 * `probeSidecar(baseUrl, fixtures)` — the black-box HTTP probe (ADR §4.2
 * "Sidecar conformance" row): runs golden HTTP fixtures against a LIVE
 * sidecar (`docker run` of the built image in the CI matrix legs).
 *
 * Deliberately GENERIC over the sidecar HTTP surface: this module knows
 * nothing about endpoints, request shapes, or response schemas — the
 * fixtures carry all of that. It does NOT define, embed, or fork the
 * sidecar OpenAPI document: the hand-authored shared OpenAPI doc and its
 * generated TypeScript client are exclusively owned by #7's spec-first PR
 * (ADR §3.2, §5.2). Until that generated client exists, the probe is typed
 * against the minimal structural surface below (`{ baseUrl }` — the shape
 * `@la/contract`'s `SidecarClient` already carries), which the future
 * generated client satisfies; when #7 lands, packs can hand the probe
 * their typed client directly and nothing here changes.
 */

/** Minimal structural target — satisfied by a raw base URL string, by
 * `@la/contract`'s `SidecarClient`, and by #7's future generated client. */
export interface SidecarBase {
  readonly baseUrl: string;
}

export type SidecarTarget = string | SidecarBase;

/** One golden HTTP fixture — the fixture owns the endpoint knowledge. */
export interface SidecarHttpFixture {
  name: string;
  request: {
    /** Path relative to the base URL (e.g. `/v1/capabilities`). */
    path: string;
    /** Defaults to GET. */
    method?: string;
    headers?: Record<string, string>;
    /** JSON-serialized when present. */
    body?: unknown;
  };
  expect: {
    status: number;
    /**
     * Structural subset the JSON response body must contain: objects match
     * key-by-key (extra actual keys allowed), arrays match index-by-index
     * with exact length, primitives match by identity. Omit to check the
     * status only.
     */
    bodySubset?: unknown;
  };
}

export interface SidecarProbeResult {
  name: string;
  pass: boolean;
  detail: string;
}

export interface ProbeSidecarOptions {
  /** Injectable for unit tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

/** Run every fixture against the live sidecar; never throws on a failing
 * probe — failures come back as `pass: false` results so a CI leg can
 * report all of them at once (use `assertProbesPass` to gate). */
export async function probeSidecar(
  target: SidecarTarget,
  fixtures: SidecarHttpFixture[],
  options: ProbeSidecarOptions = {},
): Promise<SidecarProbeResult[]> {
  const baseUrl = typeof target === "string" ? target : target.baseUrl;
  const fetchImpl = options.fetchImpl ?? fetch;
  const results: SidecarProbeResult[] = [];
  for (const fixture of fixtures) {
    results.push(await runProbe(baseUrl, fixture, fetchImpl));
  }
  return results;
}

/** Throw (listing every failing probe) unless all results pass. */
export function assertProbesPass(results: SidecarProbeResult[]): void {
  const failures = results.filter((r) => !r.pass);
  if (failures.length > 0) {
    throw new Error(
      `sidecar probes failed (${failures.length}/${results.length}):\n` +
        failures.map((f) => `  - ${f.name}: ${f.detail}`).join("\n"),
    );
  }
}

async function runProbe(
  baseUrl: string,
  fixture: SidecarHttpFixture,
  fetchImpl: typeof fetch,
): Promise<SidecarProbeResult> {
  const { request, expect: expectation } = fixture;
  let response: Response;
  try {
    response = await fetchImpl(new URL(request.path, baseUrl), {
      method: request.method ?? "GET",
      headers: {
        ...(request.body !== undefined
          ? { "content-type": "application/json" }
          : {}),
        ...request.headers,
      },
      ...(request.body !== undefined
        ? { body: JSON.stringify(request.body) }
        : {}),
    });
  } catch (err) {
    return {
      name: fixture.name,
      pass: false,
      detail: `request failed: ${String(err)}`,
    };
  }
  if (response.status !== expectation.status) {
    return {
      name: fixture.name,
      pass: false,
      detail: `expected status ${expectation.status}, got ${response.status}`,
    };
  }
  if (expectation.bodySubset !== undefined) {
    let body: unknown;
    try {
      body = await response.json();
    } catch (err) {
      return {
        name: fixture.name,
        pass: false,
        detail: `expected a JSON body: ${String(err)}`,
      };
    }
    const mismatch = subsetMismatch(expectation.bodySubset, body, "$");
    if (mismatch !== undefined) {
      return { name: fixture.name, pass: false, detail: mismatch };
    }
  }
  return { name: fixture.name, pass: true, detail: "ok" };
}

/** First structural-subset mismatch (JSONPath-ish location), or undefined. */
function subsetMismatch(
  expected: unknown,
  actual: unknown,
  path: string,
): string | undefined {
  if (expected === null || typeof expected !== "object") {
    return Object.is(expected, actual)
      ? undefined
      : `${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return `${path}: expected an array`;
    if (actual.length !== expected.length) {
      return `${path}: expected array length ${expected.length}, got ${actual.length}`;
    }
    for (let i = 0; i < expected.length; i += 1) {
      const mismatch = subsetMismatch(expected[i], actual[i], `${path}[${i}]`);
      if (mismatch !== undefined) return mismatch;
    }
    return undefined;
  }
  if (typeof actual !== "object" || actual === null || Array.isArray(actual)) {
    return `${path}: expected an object`;
  }
  for (const [key, value] of Object.entries(expected)) {
    const mismatch = subsetMismatch(
      value,
      (actual as Record<string, unknown>)[key],
      `${path}.${key}`,
    );
    if (mismatch !== undefined) return mismatch;
  }
  return undefined;
}
