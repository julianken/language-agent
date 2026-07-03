/**
 * The Cloudflare routing Worker for lexercon.com (language-router-gateway
 * plan, Task 7). Module syntax (ES module export default { fetch }).
 *
 * R-A: serves the self-contained gateway as ONE embedded HTML string
 * (`gateway-html.generated.js`, regenerated from Group A's
 * `src/apps/router/index.html`) rather than a Workers Static Assets
 * binding — `env.ASSETS` needs Cloudflare provider v5, a breaking
 * Terraform migration this plan avoids (also renames
 * `cloudflare_record`/`cloudflare_ruleset`/`cloudflare_pages_*`).
 *
 * R-C: injects `x-access-secret: env.SHARED_SECRET_<SEG>` (e.g.
 * `SHARED_SECRET_AR` for `/ar`, `SHARED_SECRET_ZH` for `/zh`) on every
 * proxied request — the server (Task 6b) rejects `/api/*` requests
 * missing it, so this Worker is the only path that can reach the
 * backends' APIs at all once the raw `run.app` URLs stop being
 * reachable via the old `api.lexercon.com`/`zh-api.lexercon.com` DNS
 * (Task 8). One secret PER INSTANCE, not a shared value — issue #11's
 * AC is "no shared secret reused across the two instances", and
 * `access-gate/main.tf` already provisions a distinct Secret Manager
 * secret per instance; this Worker's binding now matches that shape
 * (Group D resolves the mismatch `wrangler.toml`'s Task-7 NOTE flagged,
 * taking option (b): two Worker secrets, per-segment selection — not
 * option (a), collapsing the backend to one shared secret).
 *
 * `route()` is exported and extracted from `fetch` specifically so it's
 * unit-testable as a pure function (see router-worker.test.js's header
 * for why: this worktree couldn't install `wrangler`/miniflare).
 */

import { GATEWAY_HTML } from "./gateway-html.generated.js";

/** The only two path segments this Worker proxies; anything else (`/`,
 * `/favicon.ico`, a typo'd path, …) falls through to the gateway. */
const ROUTED_SEGMENTS = new Set(["ar", "zh"]);

/**
 * Pure routing decision — no I/O, no `fetch()` call — so it's testable
 * without a Workers runtime. Given a `Request` and the Worker's `env`,
 * returns either:
 *
 *   - `{ kind: "gateway" }` — serve the embedded gateway HTML.
 *   - `{ kind: "proxy", request: Request }` — the request to hand to
 *     `fetch()`, already retargeted at the correct backend host with the
 *     shared-secret header set and the ANCHORED one-segment prefix
 *     stripped from the path.
 *
 * The strip is `url.pathname.slice(seg.length + 1) || "/"` — NOT
 * `.replace()`, which would also mangle a later `/ar`/`/zh` occurring
 * deeper in the path (e.g. a hypothetical `/zh/topics/ar-numerals`). The
 * segment match itself (`url.pathname.split("/")[1]`) is already anchored
 * to exactly the first path segment, so `/arabic-page` never collides
 * with the `ar` route either.
 */
export function route(request, env) {
  const url = new URL(request.url);
  const seg = url.pathname.split("/")[1] ?? "";

  if (!ROUTED_SEGMENTS.has(seg)) {
    return { kind: "gateway" };
  }

  const hostVar = `LA_${seg.toUpperCase()}_HOST`;
  const host = env[hostVar];

  const target = new URL(request.url);
  target.hostname = host;
  target.protocol = "https:";
  target.pathname = url.pathname.slice(seg.length + 1) || "/";

  const secretVar = `SHARED_SECRET_${seg.toUpperCase()}`;

  const proxied = new Request(target, request);
  proxied.headers.set("x-access-secret", env[secretVar] ?? "");
  proxied.headers.set("Host", host);

  return { kind: "proxy", request: proxied };
}

export default {
  async fetch(request, env) {
    const decision = route(request, env);
    if (decision.kind === "gateway") {
      return new Response(GATEWAY_HTML, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    // Streams the response back as-is (method/body/SSE all pass through —
    // `fetch()` on a Request built from another Request preserves all
    // three; nothing here buffers or re-encodes the body).
    return fetch(decision.request);
  },
};
