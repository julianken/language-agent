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
