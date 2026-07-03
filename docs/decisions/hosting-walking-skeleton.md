# Hosting & IaC — walking-skeleton compute cut (issue #4 spike/ADR)

> **ADR — Status: Accepted · 2026-07-02.** **Decision:** a **hybrid split, matching the operator's production precedent** (the bird-watch pattern): the React **frontend ships to Cloudflare Pages** at `language-agent.pages.dev` (the `INSTANCE.md` target stands); the **Node/TS SSE server and the Python verification sidecar run on GCP Cloud Run** (the `architecture.md` §6 compute choice stands), deployed as **one Cloud Run service with the sidecar as a second container** (localhost networking, one deploy unit, no cross-service auth). IaC is **Terraform in a single tree spanning the `google` and `cloudflare` providers** with **GCS remote state** and **GitHub-OIDC / Workload Identity Federation** keyless deploys — all three patterns already running in the operator's sibling repos. The `architecture.md`-vs-`INSTANCE.md` "conflict" dissolves: the two documents each described one half of the same split. **Measured this spike:** the naive sidecar image is **5.47 GB** (PyTorch pulled transitively — confirmed), but the deterministic gate needs none of it; the pruned image passes identical gate probes. Resolves epic #3 Open Questions 1 and 2; unblocks #7 (sidecar), #10 (SSE renderer), #11 (deploy).

## Context

`docs/plans/architecture.md` §6 prescribes GCP Cloud Run (+ Neon/Upstash/R2/Terraform-OIDC); `INSTANCE.md` → Status independently records `https://language-agent.pages.dev` (Cloudflare Pages) as the planned deploy target. Issue #4 (plan-APPROVED) requires resolving the conflict **with measured numbers**: the verification sidecar's true container shape (the PyTorch question, epic #3 Open Question 2) and a platform check against two hard constraints — scale-to-zero and unbuffered SSE. Only the compute-hosting cut is in scope; Neon/Upstash/R2 are not re-litigated here.

## Measurements (this spike, 2026-07-02, Docker 29.2.0, `linux` images on arm64 host)

Throwaway deps-only container (`python:3.12-slim` + `pip install camel-tools` [1.6.0] + `camel_data -i morphology-db-msa-r13`) — **not committed as product infra**:

| Measurement | Result |
|---|---|
| Naive image size | **5.47 GB** |
| PyTorch pulled transitively? | **Yes** — `torch` 2.12.1 (921 MB) + `triton` (652 MB) + `nvidia-*` CUDA libs (2.9 GB) + `transformers` (105 MB) + scipy/pandas/sympy/sklearn (~330 MB) ≈ **4.9 GB of ML stack** |
| Does the deterministic gate use any of it? | **No.** After `pip uninstall` of `nvidia-*`, `torch`, `triton`, `transformers`, `sympy`, `scikit-learn`, `pandas`: dediac round-trip correct, `MorphologyDB.builtin_db()` loads, `Analyzer.analyze("كتب")` returns the same **8 analyses** |
| Analyzer-inclusive cold load (import + `builtin_db()` + `Analyzer` + first `analyze()`) | **1.12 s** naive · **1.16 s** pruned (in-container, warm disk; excludes platform image-pull/VM start) |
| Pruned single-layer image (install+prune in one layer) | **553 MB** · same probe: load 1.08 s, 8 analyses, **RSS ≈ 399 MB** |

Implications: (a) the **pruned** image is the product shape — issue #7 must install with the prune list above (or `--no-deps` + explicit deps) and treat a torch reappearance as a regression; (b) analyzer RSS ≈ 399 MB means the sidecar container should get **1 GiB memory** (512 MB is too tight once the HTTP layer sits on top; Cloudflare's `lite` tier at 256 MB is definitively out); (c) cold start is dominated by platform image pull, not the ~1.1 s analyzer load — a 553 MB image (vs 5.47 GB naive) is the difference between usable and painful scale-to-zero.

### zh row (measured by N1 = issue #19, 2026-07-02; same methodology — Docker 29.2.0, `linux` image on arm64 host)

The real deterministic-legs-only v0 image (`src/sidecars/zh/Dockerfile`: `python:3.12-slim` + FastAPI/uvicorn/pydantic + pypinyin + jieba + the baked CC-CEDICT/Unihan extracts and stub-generated sliver lexicon), reproducible via `src/sidecars/zh/scripts/measure.sh`:

| Measurement (zh v0) | Result |
|---|---|
| Image size | **207 MB** (206,671,827 bytes) — never pulls torch (no prune step needed; excluded by construction, CI-asserted) |
| Cold start (container start → first `/readyz` 200: table load + jieba prefix-dict build) | **≈ 1.2–1.3 s** (excludes platform image-pull/VM start) |
| RSS (post-warmup, after 5 `/v1/verify` calls) | **≈ 143 MiB** |

The 207 MB measurement lands **below** the est. 300–600 MB class this amendment (and the epic risk row) carried — a ~1.45× deviation below the range floor, inside the >2× amendment threshold, so the estimate row needs no re-open; the deviation direction only strengthens the deploy-zh economics (faster scale-to-zero pulls, smaller marginal run-rate). Warmup being seconds-scale (no model load) sizes #11's startup-probe window: `failureThreshold × periodSeconds` has ~2 s of true warmup to cover, dominated by image pull.

## The decision, per component

| Component | Where | Why |
|---|---|---|
| React frontend (static) | **Cloudflare Pages**, `language-agent.pages.dev` | `INSTANCE.md`'s standing target; the operator's bird-watch production pattern (`cloudflare_pages_project`); free; CDN-native |
| Node/TS SSE server | **GCP Cloud Run** (service, `min-instances=0`) | `architecture.md` §6 rationale stands (60-min timeout headroom, real concurrency, HTTP/2 streaming, no buffering of chunked responses); **operator precedent: two Cloud Run services already in production** (`bird-admin-api`, `bird-read-api`), billing live |
| Python verification sidecar | **Same Cloud Run service, second container** (multicontainer sidecar; localhost networking) | One deploy unit; no service-to-service auth surface; the gate is on the hot path of every turn — localhost beats a network hop; pruned 553 MB image + 1 GiB memory allocation fits comfortably |
| Audio blobs (Phase 1+) | Cloudflare R2 (unchanged from §6) | Out of scope here; noted for continuity |
| IaC | **Terraform, one tree, `google` + `cloudflare` providers · GCS remote state · WIF/GitHub-OIDC** | All three patterns are literally running in sibling repos: bird-watch (dual-provider tree: Pages + R2 + DNS + rulesets alongside Cloud Run/Cloud SQL), topic-synthesis (GCS backend, Cloud Run v2, Artifact Registry, logging metrics), violin-scales (`wif.tf` keyless deploys). New `infra/` in this repo follows that shape |

## SSE path

~~For v0 the Pages frontend calls the Cloud Run URL directly — the fewest proxies between the model stream and the reader.~~ *(Superseded by the lexercon.com amendment below — the API fronts through the Cloudflare proxy from day one.)* The server ships the `architecture.md` §6 SSE tripwire headers (`X-Accel-Buffering: no`, `Cache-Control: no-cache, no-transform`) from the first commit, and **#11 verifies token-by-token arrival end-to-end through the real chain** — which, post-amendment, is **behind the Cloudflare proxy at `api.lexercon.com`** — before the walking skeleton is called done. *(Correction to issue #4's citation: the SSE-buffering constraint is `architecture.md` §6's SSE tripwire; §7 risk #5 is the gloss-hallucination risk.)*

## Amendment — lexercon.com (2026-07-02)

The operator registered **`lexercon.com`** with the zone on Cloudflare (nameservers verified: `indie`/`lewis.ns.cloudflare.com`; apex unbound at amendment time). This amends the topology *without changing any platform decision* — it binds names to the pieces and upgrades the access story:

| Record | Points at | Terraform resource (bird-watch precedent) |
|---|---|---|
| `lexercon.com` (+ `www`) | the Pages frontend project (custom domain; `language-agent.pages.dev` remains the Pages-internal default) | `cloudflare_pages_domain` |
| `api.lexercon.com` | **proxied** CNAME → the Cloud Run service (`ghs.googlehosted.com` domain-mapping pattern) | `cloudflare_record` (`proxied = true`) + `cloudflare_ruleset` rate-limit |

Consequences of the amendment:
- **The v0 SSE path is now behind the Cloudflare proxy** (Pages at `lexercon.com` → `api.lexercon.com` → Cloud Run). The contingency this ADR pre-wrote ("if the API later fronts through Cloudflare DNS… repeat the verification behind the proxy") is simply day-one: #11's end-to-end token-by-token verification runs behind the proxy.
- **The access gate gets teeth**: a Cloudflare rate-limit/WAF ruleset on `api.lexercon.com` is the edge layer (bird-watch's `cloudflare_ruleset.read_api_rate_limit` precedent), **plus** a server-side shared-secret check — edge rules alone don't protect the direct `run.app` URL, so the server verifies regardless of path. Both land as #11 ACs.
- The Terraform tree gains only the two DNS-layer resources + the ruleset — no new providers, no new architecture.
- The domain is **not** a product rename: the canonical noun (`INSTANCE.md` → Product concept) is unchanged.

*(Measurement disambiguation, per the PR #12 review suggestion: the table's "1.16 s pruned" was the in-place-uninstall functional probe inside the naive image; "1.08 s" is the rebuilt single-layer pruned image — the product-shape artifact whose 553 MB / 399 MB RSS figures issues inherit. All figures round to the ~1.1 s recorded for #7's confirmation.)*

## Why not Cloudflare Containers (considered seriously)

Containers matured substantially through 2025–26 (verified via Cloudflare docs: `sleepAfter` scale-to-zero; CPU billed on **active usage** at $0.00002/vCPU-s since 2025-11-21; custom instance types GA 2026-01-05) and would be a credible single-vendor answer. Rejected for this epic because: (1) **operator precedent is decisive the other way** — three production GCP+Terraform codebases (incl. WIF) and two live Cloud Run services vs. no wrangler auth and no Containers usage anywhere in the account's repos; (2) the naive image **does not fit** the default instance tiers' disk (lite/basic: 2 GB) and `lite`'s 256 MB memory is under the analyzer's 399 MB RSS — workable pruned (553 MB) on `basic`+, but only with the routing indirection of (3): every request path runs **Worker → Durable Object → container**, an extra layer the walking skeleton doesn't need and `architecture.md` never budgeted; (4) the Node server itself would either also need a container (same conclusion as Cloud Run, minus precedent) or a workerd rewrite (not the plan). **Revisit trigger:** if Cloud Run idle economics or the Pages↔Cloud Run split adds real friction by Phase 4, or if the stack consolidates onto Cloudflare for other reasons — this ADR names Containers as the understudy, not a rejection on merits.

## Consequences

- `INSTANCE.md` → Status: deploy-target text updated (same PR) to state the split explicitly.
- `docs/plans/architecture.md` §6: annotated (same PR) to record that this ADR confirms Cloud Run for compute and lands the frontend on Pages — resolving the plan review's drift finding without rewriting §6.
- Issue **#7** (sidecar) inherits: `python:3.12-slim`, the **prune list**, `camel_data -i morphology-db-msa-r13`, `CAMELTOOLS_DATA` baked, GPL-2 notice; its real image must confirm against **553 MB / ~1.1 s load / ~400 MB RSS** (>2× deviation ⇒ amend this ADR), with **1 GiB memory** allocated to the sidecar container.
- Issue **#10** inherits the SSE header set; **#11** inherits the deploy topology + end-to-end SSE verification duty and carries the access-gate AC (the auth/abuse gap flagged during planning — attribution note: flagged in the planning session, not in the epic body; the AC now lives in #11 per the lexercon.com amendment) before a public URL exists.
- The throwaway spike Dockerfiles are **not** committed (issue #4 AC5); this ADR records their content inline above in prose form sufficient to reproduce.


## Amendment — dual-instance topology (2026-07-02)

One Cloud Run service PER language instance — the existing Terraform module instantiated twice (`for_each` over `["ar","zh"]`), each keeping the hosting ADR's shape verbatim (sidecar as second container, localhost networking, one deploy unit). Rejected: both sidecars in one service (violates the language-module ADR's "one language per instance" YAGNI guardrail and forces runtime routing the registry deliberately lacks). Domains: `zh.lexercon.com` (frontend) + `zh-api.lexercon.com` (API) — both single-level labels because Cloudflare Universal SSL covers only `*.lexercon.com`; ar keeps `lexercon.com`/`api.lexercon.com`. One Pages project, both custom domains, a build-time host→API-origin config map (composition config, no `lang===` conditional in engine code). **Deploy zh**, by this ADR's own economics: the deterministic v0 image is the same class as ar's 553 MB (**est. 300–600 MB — the single range used in the epic risk row and here**; N1 measures it, >2× deviation amends this ADR); marginal run-rate ≈ $0–2/mo. CI-only would fail to prove exactly the seam the directive exists to enforce: that the Terraform module, the one-variable rule, the startup probe, and SSE-behind-proxy are genuinely language-parameterized. `zh-api.lexercon.com` gets the same rate-limit/WAF ruleset + shared secret before URLs are public. The measured-numbers table gains a zh row (TBD → filled by N1; **filled 2026-07-02** — see "zh row" above: 207 MB, ≈1.2–1.3 s cold start, ≈143 MiB RSS). Recorded contingency: had a neural leg been required hot in v0, the recommendation would flip to CI-only-until-measured per §10.2's re-measure mandate — Decision 1's fail-closed construction is what keeps that branch untaken.

*(Full dual-instance decision record — incl. the zh deterministic-legs sidecar v0, CI matrix, and the neural-legs deferral — lives in `docs/decisions/language-module-architecture.md` → "Amendment — dual-instance walking skeleton".)*

## Amendment — apex router (language-router-gateway plan, 2026-07-03)

Supersedes the "Amendment — lexercon.com" and "Amendment — dual-instance
topology" sections above wherever they describe **split origins**
(`zh.lexercon.com` frontend, `api.lexercon.com` / `zh-api.lexercon.com`
API subdomains, the single Cloudflare Pages project, and the per-instance
`google_cloud_run_domain_mapping`). The platform decision itself is
unchanged (Cloud Run compute, one service per instance, Terraform
`for_each` over `local.instances`) — only the **name/routing layer** in
front of it moves.

**Before → after:**

| | Before (retired) | After |
|---|---|---|
| Frontend | Cloudflare Pages project, per-instance custom domain (`lexercon.com` for ar, `zh.lexercon.com` for zh) | A single self-contained gateway page (`src/apps/router`), embedded as one HTML string directly in a Cloudflare Worker script |
| API | Per-instance proxied CNAME + `google_cloud_run_domain_mapping` (`api.lexercon.com`, `zh-api.lexercon.com`) | Same Worker proxies `lexercon.com/ar/*` → the `la-ar` Cloud Run service's bare `run.app` host, `/zh/*` → `la-zh`, with the leading segment stripped and `Host` overridden |
| DNS | Per-instance `cloudflare_record` CNAMEs (one per custom domain) | One proxied placeholder apex `cloudflare_record` (`@`, type A) so the zone resolves; the Worker route (not DNS) is what actually dispatches |
| Access gate, Layer 1 (edge rate limit) | One rule, OR'd over `http.host eq "api.lexercon.com"` / `"...zh-api..."` | One rule: `http.host eq "lexercon.com"` AND OR'd over each instance's `<base_path>/api` path prefix |
| Access gate, Layer 2 (server-side secret) | `SHARED_SECRET` env wired but **not enforced** by the server | **Enforced**: the server rejects `/api/*` requests missing `x-access-secret`; the Worker is the only path that can supply it, injecting a value from a PER-INSTANCE Cloudflare secret binding (`SHARED_SECRET_AR` / `SHARED_SECRET_ZH`) that reads the same Secret Manager secret each backend already uses |
| Terraform | `frontend-pages` module (1) + `dns-domain` module (×2, `for_each`) | `worker.tf`: `cloudflare_workers_script` + `cloudflare_workers_route` + the apex record — no `for_each`, since one Worker fronts both instances |

**Why:** the split-origin topology never actually shipped pretty
`lexercon.com/ar` / `lexercon.com/zh` URLs — it hard-required a second
subdomain per instance and a Google domain-verification step per API
domain, and (per the deferred item this amendment also closes) left the
access gate's Layer 2 wired but inert. The apex router collapses both
instances onto one host, needs no Google domain verification (the Worker
overrides `Host` directly against each service's own `run.app` URL —
no `google_cloud_run_domain_mapping` involved), and is what finally
makes the server-side secret check load-bearing: once the old API
subdomains stop resolving, the Worker (with its per-instance secret) is
the only path that can reach either backend's `/api/*` surface at all.

**Consequences:**
- `INSTANCE.md` → Status: URL map amended (same PR) — apex router +
  `/ar` `/zh` path routes replace the split-origin map.
- `DESIGN.md` → Components: gains `router-page`, `language-card`,
  `router-wordmark` (same PR) — no new tokens.
- A real `terraform plan` against this amendment **destroys** the
  `frontend_pages` module's Pages project + custom-domain bindings +
  CNAME records, and each instance's `dns_domain` module's proxied CNAME
  + `google_cloud_run_domain_mapping` — and **creates** the Worker
  script, Worker route, and the new apex record. Not yet applied (this
  PR is author + `validate` only, per the worktree's hard constraints).
- **Cold-start TTFT stays open**, tracked in `GAPS.md`: scale-to-zero
  measured ≈12s (ar) / ≈6s (zh) first-token, ≈0.2s warm — a
  `min_instances` decision this amendment doesn't resolve.
