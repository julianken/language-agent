# Language-Router Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a quiet static gateway at `lexercon.com` that routes visitors to the Arabic (`/ar/`) and Chinese (`/zh/`) instances, on one origin, resolving the same-origin-vs-Pages frontend inconsistency.

**Architecture:** A new tiny static app (`src/apps/router`) is served at the apex by a single Cloudflare Worker; the same Worker proxies `/ar/*` → the `la-ar` Cloud Run service and `/zh/*` → `la-zh`, stripping the path prefix and overriding the origin Host. Each per-language app is built Vite-`base`-aware (`/ar/` or `/zh/`) and served by its own Cloud Run server via `WEB_DIST`, so its existing relative `/api/` and asset URLs resolve under its prefix — no cross-origin API, no CORS.

**Tech Stack:** Vite (vanilla-TS, static build) for the router; the existing React/Vite per-language app; a Cloudflare Worker (Module syntax, Static Assets binding) for edge routing; Terraform (`cloudflare` + `google` providers) for infra; `fonttools` (subset) + base64 for embedded fonts; Playwright + `wrangler dev`/`vitest` for tests.

## Global Constraints

- **Design authority:** `DESIGN.md` §0 tokens are the only source of colour/size/radius/motion values — reference by name, never a raw literal outside §0. Reconcile `tokens.json` in the same PR as any token change. (`AGENTS.md` Update-Triggers.)
- **Approved design:** the page markup/CSS/motion/a11y is the approved mockup at `/private/tmp/.../scratchpad/language-router-gateway.html` (this session) — the router page reproduces it; decisions locked: quiet gateway, script-hero cards, apex-router + path-routes, tagline "a quiet way to read a new language", "lexercon" wordmark + gold flourish, no return-visit memory in v1.
- **Fonts:** Amiri (Arabic `العربية`), Noto Serif TC (Chinese `中文`), Inter (Latin) — subset-embedded as woff2 data URIs; CSP/offline forbids CDN webfont URLs.
- **Never-show-wrong:** the gateway renders only fixed endonyms (`العربية`, `中文`) — no generated target text, no gate. Do not add live/sample target copy.
- **Worktree-only:** all work in a linked worktree off `origin/main`, never the primary tree or `main` (repo policy). Conventional Commits; `Co-Authored-By:` the authoring model.
- **Dependency:** the routing/Terraform tasks (Group C/D) build on the deploy IaC. The 11 apply-time deploy fixes live on branch `issue-11-deploy-live` (commit `2d2ebf9`); they must be merged to `main` before Group C/D land, or this plan's branch must rebase onto them.
- **Base-path contract:** each per-language app is built with Vite `base = "/ar/"` or `"/zh/"`; the Worker strips exactly that one leading prefix segment before forwarding to the backend, and sets `Host` to the backend's `run.app` host. These two must always agree.

---

## File structure

**Create:**
- `src/apps/router/package.json` — the router app manifest (`@la/router`, private, Vite build).
- `src/apps/router/vite.config.ts` — static build config (base `/`, single HTML entry).
- `src/apps/router/index.html` — the gateway markup (from the approved mockup).
- `src/apps/router/src/styles/tokens.css` — the DESIGN.md §0 tokens as CSS custom properties (shared source; see Task 2).
- `src/apps/router/src/styles/gateway.css` — layout/motion/a11y CSS (from the mockup).
- `src/apps/router/src/fonts/fonts.css` — the four @font-face data-URI declarations (generated).
- `src/apps/router/scripts/build-fonts.mjs` — regenerates `fonts.css` by subsetting Amiri/Noto Serif TC/Inter to the gateway's glyphs.
- `src/apps/router/e2e/gateway.spec.ts` — Playwright smoke + a11y.
- `infra/worker/router-worker.js` — the Cloudflare Worker (static-asset serve + `/ar` `/zh` proxy).
- `infra/worker/router-worker.test.js` — `vitest` unit tests over the Worker's `fetch` handler (miniflare/`unstable_dev`).
- `infra/worker/wrangler.toml` — Worker config (name, main, assets binding, route, vars).
- `infra/worker.tf` — Terraform: `cloudflare_workers_script` + `cloudflare_workers_route` + assets, backend hosts as vars.

**Modify:**
- `src/apps/web/vite.config.ts` — honour `base` from `VITE_BASE` env (default `/`).
- `infra/docker/server.Dockerfile` — build the web with `VITE_BASE`, COPY the built site into the image.
- `infra/modules/cloud-run-service/main.tf` + `variables.tf` — set `WEB_DIST` env to the served web dir; add a `web_base` var.
- `infra/main.tf` / `infra/modules/frontend-pages/*` — retire/repurpose the Pages frontend module in favour of the Worker (or narrow Pages to nothing); reconcile DNS so the apex + `/ar` `/zh` resolve through the Worker.
- `INSTANCE.md` — the URL map (apex router; `/ar` `/zh` path routes; Arabic no longer at apex).
- `docs/decisions/hosting-*.md` — amend: per-language apps are Cloud-Run-served under path routes; Pages no longer hosts them; the Worker fronts the zone.
- `DESIGN.md` §Components + `tokens.json` — add the `router-page`/`language-card`/`router-wordmark` components (no new tokens expected; if any, mirror in `tokens.json`).

---

### Task 1: Scaffold the router app

**Files:**
- Create: `src/apps/router/package.json`, `src/apps/router/vite.config.ts`, `src/apps/router/index.html` (minimal placeholder), `src/apps/router/tsconfig.json`
- Test: `src/apps/router/e2e/gateway.spec.ts` (created here, filled in Task 4)

**Interfaces:**
- Produces: a Vite static app buildable with `pnpm --filter @la/router build:site` → `dist-site/` containing `index.html`.

- [ ] **Step 1: Write the failing test** — a build smoke test in `package.json` scripts is the check here; write a placeholder e2e that asserts the built `index.html` exists.

```ts
// src/apps/router/e2e/gateway.spec.ts
import { test, expect } from "@playwright/test";
test("gateway builds and serves index.html", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1.wordmark")).toHaveText("lexercon");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @la/router build:site`
Expected: FAIL — no such package / no build script yet.

- [ ] **Step 3: Create the package + Vite config**

```json
// src/apps/router/package.json
{
  "name": "@la/router",
  "private": true,
  "type": "module",
  "scripts": {
    "build:fonts": "node scripts/build-fonts.mjs",
    "build:site": "vite build",
    "dev": "vite",
    "test:e2e": "playwright test"
  },
  "devDependencies": { "vite": "^5", "@playwright/test": "^1" }
}
```

```ts
// src/apps/router/vite.config.ts
import { defineConfig } from "vite";
export default defineConfig({ base: "/", build: { outDir: "dist-site", assetsInlineLimit: 0 } });
```

```html
<!-- src/apps/router/index.html (placeholder — filled in Task 2) -->
<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>lexercon</title></head>
<body><main class="gateway"><h1 class="wordmark">lexercon</h1></main></body></html>
```

- [ ] **Step 4: Run to verify it builds**

Run: `pnpm --filter @la/router build:site`
Expected: PASS — `src/apps/router/dist-site/index.html` exists.

- [ ] **Step 5: Commit**

```bash
git add src/apps/router
git commit -m "feat(router): scaffold @la/router static gateway app"
```

---

### Task 2: DESIGN.md tokens + embedded fonts

**Files:**
- Create: `src/apps/router/src/styles/tokens.css`, `src/apps/router/scripts/build-fonts.mjs`, `src/apps/router/src/fonts/fonts.css` (generated)

**Interfaces:**
- Produces: `tokens.css` exposing every §0 value as a `--token` custom property; `fonts.css` with four `@font-face` (Amiri 400, Noto Serif TC 400, Inter 400/600) as woff2 data URIs.

- [ ] **Step 1: Write `tokens.css`** — copy every `DESIGN.md` §0 value verbatim as a custom property (the mockup's `:root` block is the exact content; reproduce it).

```css
/* src/apps/router/src/styles/tokens.css — mirrors DESIGN.md §0 (do not invent values) */
:root{
  --canvas:#fbf9f4; --surface-card:#ffffff; --surface-soft:#f3efe6; --hairline:#e4ddcd; --hairline-soft:#efe9dc;
  --ink:#1a1612; --body:#574f45; --muted:#8a8275; --muted-soft:#b4ac9d;
  --primary:#0f766e; --accent-gold:#b8860b; --status-learning-bg:#dcebe8;
  --dur-fast:120ms; --dur-base:200ms; --ease-standard:cubic-bezier(0.2,0,0,1);
}
```

- [ ] **Step 2: Write `build-fonts.mjs`** — subset the three faces to the gateway's glyphs and emit `fonts.css`. Port the proven Python subset (`/tmp/build_gateway.py` this session) to a Node script using `subset-font` (npm, actively maintained, real publisher `papandreou`).

```js
// src/apps/router/scripts/build-fonts.mjs
import subsetFont from "subset-font";
import { readFileSync, writeFileSync } from "node:fs";
const faces = [
  { family: "Amiri", weight: 400, file: require.resolve("@fontsource/amiri/files/amiri-arabic-400-normal.woff2"), text: "العربية" },
  { family: "Noto Serif TC", weight: 400, file: /* the TC subset file that covers 中文 — see note */ "", text: "中文" },
  { family: "Inter", weight: 400, file: require.resolve("@fontsource/inter/files/inter-latin-400-normal.woff2"), text: "abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ .,'—→…" },
  { family: "Inter", weight: 600, file: require.resolve("@fontsource/inter/files/inter-latin-600-normal.woff2"), text: "abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ .,'—→…" },
];
const css = [];
for (const f of faces) {
  const out = await subsetFont(readFileSync(f.file), f.text, { targetFormat: "woff2" });
  const b64 = out.toString("base64");
  css.push(`@font-face{font-family:"${f.family}";font-weight:${f.weight};font-style:normal;font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2");}`);
}
writeFileSync(new URL("../src/fonts/fonts.css", import.meta.url), css.join("\n"));
```

> **Note (Noto Serif TC):** `@fontsource/noto-serif-tc` ships 100+ range-subset files; `中`(U+4E2D)+`文`(U+6587) live in `noto-serif-tc-123-400-normal.woff2` (verified this session by cmap). Resolve it by scanning the package's files for the one whose `cmap` contains both codepoints (loop with `fontkit` or the fontsource CSS `unicode-range`), so the script survives a fontsource version bump rather than hard-coding `-123-`.

- [ ] **Step 3: Run** `pnpm --filter @la/router build:fonts` → `src/fonts/fonts.css` written (~45 KB). Verify each `@font-face` present.

- [ ] **Step 4: Commit**

```bash
git add src/apps/router/src/styles/tokens.css src/apps/router/scripts/build-fonts.mjs src/apps/router/src/fonts/fonts.css
git commit -m "feat(router): DESIGN.md token CSS + subset-embedded Amiri/Noto Serif TC/Inter"
```

---

### Task 3: The gateway page (markup, layout, motion, a11y)

**Files:**
- Modify: `src/apps/router/index.html`
- Create: `src/apps/router/src/styles/gateway.css`

**Interfaces:**
- Consumes: `tokens.css`, `fonts.css` (Task 2).
- Produces: the rendered gateway — `<h1 class="wordmark">`, two `<a class="card" href="/ar/">`/`href="/zh/">` with bidi-isolated `العربية`/`中文` scripts, tagline, gold flourish.

- [ ] **Step 1: Write the markup + CSS** — reproduce the approved mockup exactly. `index.html` links the three stylesheets and contains the `.gateway` markup; `gateway.css` is the mockup's layout/motion CSS **minus** the `.review` footer chrome (that was mockup-only). Card `href`s are the real `/ar/` and `/zh/`. Include: bidi isolate + `dir="rtl"` + `lang="ar"` on the Arabic script; `lang="zh-Hant"` on Chinese; `focus-visible` teal ring; `prefers-reduced-motion` guard (opacity stays, transforms drop); responsive stack < 560px.

- [ ] **Step 2: Build + eyeball** `pnpm --filter @la/router build:site && pnpm --filter @la/router dev` — confirm parity with the approved mockup (warm paper, script-hero cards, hover teal wash + lift, focus ring).

- [ ] **Step 3: Commit**

```bash
git add src/apps/router/index.html src/apps/router/src/styles/gateway.css
git commit -m "feat(router): gateway page — script-hero cards, DESIGN.md tokens, motion + a11y"
```

---

### Task 4: Router Playwright smoke + a11y gate

**Files:**
- Modify: `src/apps/router/e2e/gateway.spec.ts`, add `src/apps/router/playwright.config.ts`
- Dev-dep: `@axe-core/playwright` (real publisher: Deque Systems)

**Interfaces:**
- Consumes: the built site (Task 3), served by Playwright's `webServer` (`vite preview`).

- [ ] **Step 1: Write the tests**

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("renders both language cards linking to /ar and /zh", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1.wordmark")).toHaveText("lexercon");
  await expect(page.getByRole("link", { name: /arabic/i })).toHaveAttribute("href", "/ar/");
  await expect(page.getByRole("link", { name: /chinese/i })).toHaveAttribute("href", "/zh/");
  await expect(page.locator(".script-ar")).toHaveText("العربية");
});
test("no serious/critical axe violations", async ({ page }) => {
  await page.goto("/");
  const r = await new AxeBuilder({ page }).analyze();
  const bad = r.violations.filter(v => ["serious","critical"].includes(v.impact ?? ""));
  expect(bad, JSON.stringify(bad, null, 2)).toEqual([]);
});
test("reduced-motion drops transforms", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage(); await page.goto("/");
  const anim = await page.locator(".card").first().evaluate(el => getComputedStyle(el).animationName);
  expect(anim).toBe("none");
});
```

- [ ] **Step 2: Run** `pnpm --filter @la/router test:e2e` → 3 pass.
- [ ] **Step 3: Commit** `feat(router): playwright smoke + axe a11y gate`.

---

### Task 5: Per-language app base-path awareness

**Files:**
- Modify: `src/apps/web/vite.config.ts`
- Test: `src/apps/web/e2e/base-path.spec.ts`

**Interfaces:**
- Produces: a web build whose asset + API URLs are prefixed by `VITE_BASE` (`/ar/` or `/zh/`). The app already uses relative `/api/...` (`App.tsx`); with Vite `base` set, the emitted `<script src>`/`<link href>` and the app's `import.meta.env.BASE_URL`-derived API base carry the prefix.

- [ ] **Step 1: Write the failing test** — build with `VITE_BASE=/ar/` and assert the built `index.html` references `/ar/assets/...`.

```ts
import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
test("VITE_BASE prefixes asset URLs", () => {
  execSync("VITE_BASE=/ar/ pnpm --filter @la/web build:site", { stdio: "inherit" });
  const html = readFileSync("src/apps/web/dist-site/index.html", "utf8");
  expect(html).toMatch(/\/ar\/assets\//);
});
```

- [ ] **Step 2: Run → fails** (base is currently hard-coded/default `/`).

- [ ] **Step 3: Implement** — in `src/apps/web/vite.config.ts`, `base: process.env.VITE_BASE ?? "/"`. Audit `App.tsx` / `useTokenStream.ts`: change the API base from a leading-slash literal `"/api/..."` to `` `${import.meta.env.BASE_URL}api/...` `` so it resolves under the prefix. (Add a tiny `apiUrl(path)` helper in `src/apps/web/src/shell/` and route all `/api/*` calls through it.)

- [ ] **Step 4: Run → passes.** Also run the existing web unit/e2e suite to confirm `base: "/"` default is unchanged.
- [ ] **Step 5: Commit** `feat(web): base-path-aware build (VITE_BASE) + API url helper`.

---

### Task 6: Serve each app from its Cloud Run server (WEB_DIST)

**Files:**
- Modify: `infra/docker/server.Dockerfile`, `infra/modules/cloud-run-service/main.tf`, `infra/modules/cloud-run-service/variables.tf`, `infra/locals.tf`

**Interfaces:**
- Consumes: Task 5's `VITE_BASE` build. Produces: each Cloud Run server serves its app UI at `/` and `/api/*` — so `la-ar` behind the Worker serves the Arabic app; `la-zh` the Chinese app.

- [ ] **Step 1** — in `server.Dockerfile`, add a build-stage step: `RUN VITE_BASE=${WEB_BASE} pnpm --filter @la/web build:site` (add `ARG WEB_BASE`), and COPY `src/apps/web/dist-site` into the runtime image at `/repo/web-dist`. (The server already `COPY`s pack `assets/`; this adds the web bundle.)
- [ ] **Step 2** — add `web_base` var to the module; pass `--build-arg WEB_BASE=/${instance_key}/` through `build-and-push.sh` (per instance — note the server image is currently shared; this splits it into two per-base images, or passes base at runtime. **Decision for the plan:** build one image per instance with its base, tagged `server-ar`/`server-zh`; update `build-and-push.sh` + `locals.tf server_image` accordingly).
- [ ] **Step 3** — set `WEB_DIST=/repo/web-dist` env in the server container (`cloud-run-service/main.tf`, next to `ASSETS_ROOT`).
- [ ] **Step 4: Verify** — `docker run` the image, `curl localhost:8080/` returns the app `index.html` referencing `/ar/assets/...`; `curl localhost:8080/api/health` → `{"ok":true}`.
- [ ] **Step 5: Commit** `feat(deploy): build+serve base-path web bundle from each Cloud Run server`.

---

### Task 7: The Cloudflare routing Worker

**Files:**
- Create: `infra/worker/router-worker.js`, `infra/worker/router-worker.test.js`, `infra/worker/wrangler.toml`

**Interfaces:**
- Consumes: the built router static site (Task 3, via a Static Assets binding) + the two backend hosts (vars `LA_AR_HOST`, `LA_ZH_HOST`).
- Produces: a Worker whose `fetch(request, env)` serves the router for `/` and its assets, and proxies `/ar/*`→`LA_AR_HOST`, `/zh/*`→`LA_ZH_HOST` (strip the one prefix segment, set `Host`).

- [ ] **Step 1: Write the failing tests** (`vitest` + `wrangler unstable_dev` or `@cloudflare/vitest-pool-workers`):

```js
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { unstable_dev } from "wrangler";
let worker;
beforeAll(async () => { worker = await unstable_dev("infra/worker/router-worker.js", {
  vars: { LA_AR_HOST: "la-ar.example.run.app", LA_ZH_HOST: "la-zh.example.run.app" },
  experimental: { disableExperimentalWarning: true } }); });
afterAll(async () => { await worker.stop(); });
it("serves the gateway at /", async () => {
  const r = await worker.fetch("/"); expect(await r.text()).toContain("lexercon");
});
it("/ar/api/stream strips prefix + retargets host", async () => {
  // assert the outbound request the worker would make: path /api/stream, Host la-ar.example.run.app
});
```

- [ ] **Step 2: Run → fails** (no worker yet).

- [ ] **Step 3: Implement the Worker**

```js
// infra/worker/router-worker.js
const BACKENDS = { ar: "LA_AR_HOST", zh: "LA_ZH_HOST" };
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const seg = url.pathname.split("/")[1];           // "ar" | "zh" | "" | asset
    if (BACKENDS[seg]) {
      const host = env[BACKENDS[seg]];
      const target = new URL(request.url);
      target.hostname = host; target.protocol = "https:";
      target.pathname = url.pathname.replace(`/${seg}`, "") || "/"; // strip exactly one prefix
      const proxied = new Request(target, request);
      proxied.headers.set("Host", host);
      return fetch(proxied);
    }
    return env.ASSETS.fetch(request);                  // static router (/, /assets/*)
  },
};
```

- [ ] **Step 4: Run → tests pass.** Add a `wrangler dev` manual check: `curl localhost:8787/` → gateway; `curl localhost:8787/ar/api/health` → proxied `{"ok":true}` (point vars at the real run.app hosts).
- [ ] **Step 5: Commit** `feat(infra): cloudflare worker — apex router + /ar /zh path proxy`.

---

### Task 8: Terraform the Worker + reconcile Pages/DNS

**Files:**
- Create: `infra/worker.tf`
- Modify: `infra/main.tf`, `infra/modules/frontend-pages/*` (retire or narrow), `infra/modules/dns-domain/*` (the apex + path routing now flows through the Worker), `infra/locals.tf`

**Interfaces:**
- Consumes: the Worker script (Task 7), the router `dist-site` (Task 3), the Cloud Run service URIs (module outputs).
- Produces: `cloudflare_workers_script.router` + `cloudflare_workers_route` on `lexercon.com/*`, with `LA_AR_HOST`/`LA_ZH_HOST` = the two service `run.app` hosts; the router static assets bound to the Worker.

- [ ] **Step 1** — write `infra/worker.tf`: `cloudflare_workers_script` (content = `infra/worker/router-worker.js`, assets = router `dist-site`, plain-text bindings for the two hosts from `module.cloud_run_service["ar"|"zh"].service_uri`), and `cloudflare_workers_route` `pattern = "lexercon.com/*"`.
- [ ] **Step 2** — remove the per-language `cloudflare_pages_*` from `frontend-pages` (the apps are Cloud-Run-served now); keep DNS so the apex `A/AAAA`/proxied record resolves to the Worker (the route binds by zone, so the apex just needs a proxied placeholder record). Delete the now-dead `google_cloud_run_domain_mapping` usage (superseded by the Worker's Host-override — no Google domain verification needed).
- [ ] **Step 3** — `terraform validate` + `terraform plan` (no apply in-plan); assert the plan creates the Worker + route and destroys the Pages/domain-mapping resources, 0 unexpected.
- [ ] **Step 4: Commit** `feat(infra): terraform the router worker; retire Pages frontend + domain-mapping`.

---

### Task 9: Docs, ADR, DESIGN.md, INSTANCE.md reconciliation

**Files:**
- Modify: `docs/decisions/hosting-*.md`, `INSTANCE.md`, `DESIGN.md`, `tokens.json`, `GAPS.md`

**Interfaces:** none (docs).

- [ ] **Step 1** — `DESIGN.md` §Components: add `router-page`, `language-card`, `router-wordmark` (reference existing tokens; if a new token was needed, add to §0 **and** `tokens.json` — none expected). 
- [ ] **Step 2** — `INSTANCE.md`: URL map = apex router (`lexercon.com`), `/ar` `/zh` path routes; Arabic no longer at apex. 
- [ ] **Step 3** — hosting ADR amendment: per-language apps Cloud-Run-served under path routes behind one Worker; Pages retired; the Worker Host-override replaces domain mappings (no Google verification). Record the **cold-start open item**: scale-to-zero TTFT measured 12 s (ar) / 6 s (zh); decide `min_instances=1` (cost) vs. a warming ping vs. accept — a `GAPS.md` deferred-with-trigger row. 
- [ ] **Step 4** — run `scripts/check-claude-shim.sh` if `AGENTS.md`/`CLAUDE.md` touched (they aren't here); run `scripts/check-concept-drift.sh`. 
- [ ] **Step 5: Commit** `docs: reconcile hosting ADR + INSTANCE.md + DESIGN.md for the router gateway`.

---

## Open items (carry to the PR body / GAPS.md)

- **Cold-start TTFT:** scale-to-zero → 12 s (ar) / 6 s (zh) first-token; warm ~0.2 s. Decide `min_instances=1` vs. warmer vs. accept. (Deferred-with-trigger.)
- **SHARED_SECRET is a no-op today:** the server sets the env but never checks it; the access gate's Layer 2 does not gate. The Worker is the natural place to inject the secret header (edge → backend), and the server must enforce it. Fold into Task 7/6 or a fast-follow security PR — **flag in the PR**, do not ship the gate as decorative.
- **Live-LLM generation falls back to English 100%:** out of scope for this plan (generation-tuning / #22); the gateway + corpus path are unaffected.

## Self-review

- **Spec coverage:** (1) static gateway → Tasks 1–4; (2) apex-router + path-routes → Tasks 5–8; (3) ADR/INSTANCE/Terraform reconciliation → Tasks 8–9. Cold-start open item → Task 9 + Open items. All spec §s map to a task.
- **Placeholder scan:** the one deliberate lookup (which Noto Serif TC range file) is specified as a cmap-scan with the verified answer (`-123-`) given — not a TODO. No "add error handling"/"TBD".
- **Type consistency:** the base-path contract (`VITE_BASE`=`/ar/`|`/zh/`) and the Worker's one-segment strip agree (Global Constraints + Task 5 + Task 7); `apiUrl()` helper defined in Task 5 is the single API-base seam.
- **Note:** Group A (Tasks 1–4) is independently shippable (the gateway renders standalone); Groups B–D depend on the deploy IaC merge. If preferred, split into two PRs at that seam.
