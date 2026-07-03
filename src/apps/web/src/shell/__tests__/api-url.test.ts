/**
 * `apiUrl` (Task 5 of the language-router-gateway plan, R-B/R-E): the
 * single seam every `/api/*` call site routes through so requests carry
 * whatever runtime base-path the server injects via `<base href="/ar/">`
 * / `<base href="/zh/">` (Task 6) — or the plain origin in dev/e2e, where
 * no `<base>` is injected and the default base `/` behavior is unchanged.
 *
 * This workspace has no jsdom/happy-dom dependency, so these tests pass an
 * explicit `base` standing in for what `document.baseURI` resolves to once
 * a `<base href>` element is present — the same resolution algorithm a
 * real `<base>` element drives. The last test stubs the one `document`
 * property the implementation actually reads (no full DOM needed) to prove
 * the default-parameter wiring to `document.baseURI` itself.
 */

import { afterEach, describe, expect, it } from "vitest";
import { apiUrl } from "../api-url.js";

describe("apiUrl", () => {
  it("prefixes with the runtime base path when a <base href> is in force (e.g. /ar/)", () => {
    expect(apiUrl("learning-events", "https://lexercon.com/ar/")).toBe(
      "https://lexercon.com/ar/api/learning-events",
    );
  });

  it("prefixes with the zh base path", () => {
    expect(apiUrl("health", "https://lexercon.com/zh/")).toBe(
      "https://lexercon.com/zh/api/health",
    );
  });

  it("keeps the default (base '/') behavior unchanged — no prefix beyond /api", () => {
    expect(apiUrl("learning-events", "http://localhost:8787/")).toBe(
      "http://localhost:8787/api/learning-events",
    );
  });

  it("carries query strings through unchanged", () => {
    expect(
      apiUrl("stream?turn=abc123&delayMs=60", "https://lexercon.com/zh/"),
    ).toBe("https://lexercon.com/zh/api/stream?turn=abc123&delayMs=60");
  });

  describe("default base — reads document.baseURI (no base arg passed, as every real call site does)", () => {
    afterEach(() => {
      delete (globalThis as { document?: unknown }).document;
    });

    it("resolves against document.baseURI when base is omitted", () => {
      (globalThis as { document?: { baseURI: string } }).document = {
        baseURI: "https://lexercon.com/ar/",
      };
      expect(apiUrl("stream")).toBe("https://lexercon.com/ar/api/stream");
    });
  });
});
