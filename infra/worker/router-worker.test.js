/**
 * Unit tests for `route()`, `infra/worker/router-worker.js`'s pure routing
 * decision (language-router-gateway plan, Task 7).
 *
 * DEVIATION FROM THE PLAN, NOTED: the plan's first choice was `vitest` +
 * `wrangler`'s `unstable_dev` (or `@cloudflare/vitest-pool-workers`) to
 * exercise the Worker inside a real `workerd` runtime. `infra/worker`
 * isn't part of the pnpm workspace (like `src/sidecars`, it's deliberately
 * outside `pnpm-workspace.yaml`), and pulling in `wrangler` — a large,
 * network-fetching, `workerd`-binary-downloading devDependency — for one
 * test file felt disproportionate inside an agent worktree with a fixed
 * task budget, so this takes the plan's own explicitly sanctioned
 * fallback instead: "write the tests as pure-function unit tests over an
 * extracted `route(url, env)` helper instead, and note it."
 *
 * `route()` is exercised here with real `Request`/`URL`/`Headers`
 * globals (Node 24's built-in `undici` fetch implementation — no DOM/
 * jsdom needed, same Fetch-spec objects Cloudflare Workers use) via
 * `vitest`, which is already a root workspace devDependency (see
 * package.json's `catalog: vitest`) — no new dependency was added. What
 * this does NOT cover: the real `workerd` runtime, the Static-file-vs-
 * fetch dispatch inside `export default { fetch }` itself (a two-line
 * wrapper around `route()` — see router-worker.js), and true SSE
 * passthrough. Those need a real Worker runtime; the manual verification
 * commands are recorded at the bottom of this file's comments for
 * whoever adds `wrangler` to this repo later.
 *
 * Run: `node --experimental-vm-modules node_modules/.bin/vitest run
 * infra/worker/router-worker.test.js` from the repo root (root's vitest
 * binary; infra/worker has no package.json/workspace membership of its
 * own, so there's no `pnpm --filter` form of this command).
 */

import { describe, expect, it } from "vitest";
import { route } from "./router-worker.js";

const ENV = {
  LA_AR_HOST: "la-ar-abc123-uc.a.run.app",
  LA_ZH_HOST: "la-zh-def456-uc.a.run.app",
  SHARED_SECRET: "top-secret-value",
};

describe("route() — gateway paths", () => {
  it("serves the gateway at /", () => {
    const decision = route(new Request("https://lexercon.com/"), ENV);
    expect(decision.kind).toBe("gateway");
  });

  it("serves the gateway for an unrelated path", () => {
    const decision = route(new Request("https://lexercon.com/favicon.ico"), ENV);
    expect(decision.kind).toBe("gateway");
  });

  it("serves the gateway for a path that merely starts with ar/zh as a longer segment (anchored match)", () => {
    // "/arabic-page" must NOT be treated as the /ar route — split("/")[1]
    // is the WHOLE first segment ("arabic-page"), not a substring prefix.
    expect(route(new Request("https://lexercon.com/arabic-page"), ENV).kind).toBe(
      "gateway",
    );
    expect(route(new Request("https://lexercon.com/zhengzhou"), ENV).kind).toBe(
      "gateway",
    );
  });
});

describe("route() — /ar/* proxy", () => {
  it("strips the /ar prefix and retargets the host", () => {
    const decision = route(
      new Request("https://lexercon.com/ar/api/health"),
      ENV,
    );
    expect(decision.kind).toBe("proxy");
    const url = new URL(decision.request.url);
    expect(url.hostname).toBe(ENV.LA_AR_HOST);
    expect(url.pathname).toBe("/api/health");
  });

  it("carries the shared-secret header on the proxied request", () => {
    const decision = route(
      new Request("https://lexercon.com/ar/api/health"),
      ENV,
    );
    expect(decision.request.headers.get("x-access-secret")).toBe(
      "top-secret-value",
    );
  });

  it("preserves query strings", () => {
    const decision = route(
      new Request("https://lexercon.com/ar/api/stream?turn=abc&delayMs=60"),
      ENV,
    );
    const url = new URL(decision.request.url);
    expect(url.pathname).toBe("/api/stream");
    expect(url.searchParams.get("turn")).toBe("abc");
    expect(url.searchParams.get("delayMs")).toBe("60");
  });

  it("collapses the bare /ar path to /", () => {
    const decision = route(new Request("https://lexercon.com/ar"), ENV);
    expect(new URL(decision.request.url).pathname).toBe("/");
  });

  it("collapses /ar/ to /", () => {
    const decision = route(new Request("https://lexercon.com/ar/"), ENV);
    expect(new URL(decision.request.url).pathname).toBe("/");
  });

  it("preserves method and body on a POST (e.g. POST /api/turns)", async () => {
    const original = new Request("https://lexercon.com/ar/api/turns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ learnerMessage: "hello" }),
    });
    const decision = route(original, ENV);
    expect(decision.request.method).toBe("POST");
    expect(decision.request.headers.get("content-type")).toBe(
      "application/json",
    );
    expect(await decision.request.text()).toBe(
      JSON.stringify({ learnerMessage: "hello" }),
    );
  });

  it("does not corrupt a deeper path that happens to contain 'zh' or 'ar' as a later segment", () => {
    const decision = route(
      new Request("https://lexercon.com/ar/topics/zh-numerals"),
      ENV,
    );
    expect(new URL(decision.request.url).pathname).toBe("/topics/zh-numerals");
  });
});

describe("route() — /zh/* proxy", () => {
  it("strips the /zh prefix and retargets to the zh host", () => {
    const decision = route(
      new Request("https://lexercon.com/zh/api/health"),
      ENV,
    );
    expect(decision.kind).toBe("proxy");
    const url = new URL(decision.request.url);
    expect(url.hostname).toBe(ENV.LA_ZH_HOST);
    expect(url.pathname).toBe("/api/health");
  });

  it("never sends the ar host for a /zh/* request", () => {
    const decision = route(
      new Request("https://lexercon.com/zh/api/health"),
      ENV,
    );
    expect(new URL(decision.request.url).hostname).not.toBe(ENV.LA_AR_HOST);
  });
});

describe("route() — edge cases", () => {
  it("falls back to an empty secret header rather than throwing when SHARED_SECRET is unset", () => {
    const envNoSecret = { LA_AR_HOST: ENV.LA_AR_HOST, LA_ZH_HOST: ENV.LA_ZH_HOST };
    const decision = route(
      new Request("https://lexercon.com/ar/api/health"),
      envNoSecret,
    );
    expect(decision.request.headers.get("x-access-secret")).toBe("");
  });
});

/**
 * Manual `wrangler dev` verification (not run by this suite — no live
 * Worker runtime here). Point vars at real values, then:
 *
 *   wrangler dev infra/worker/router-worker.js \
 *     --var LA_AR_HOST:la-ar-<hash>-uc.a.run.app \
 *     --var LA_ZH_HOST:la-zh-<hash>-uc.a.run.app \
 *     --var SHARED_SECRET:<the real value>
 *
 *   curl -s http://localhost:8787/ | grep -o '<title>[^<]*</title>'
 *     → <title>lexercon</title>
 *
 *   curl -s -D - -o /dev/null http://localhost:8787/ar/api/health
 *     → the proxied response's headers (200, JSON content-type) — proves
 *       the real run.app host answered, not a Worker-local stub.
 *
 *   curl -s -D - -o /dev/null http://localhost:8787/ar/api/health \
 *     -H 'x-access-secret: wrong'
 *     → 403 from the SERVER (Task 6b), reached only because the Worker
 *       proxied it through — proves the header actually lands.
 */
