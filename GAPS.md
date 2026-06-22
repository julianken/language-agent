# GAPS.md

A ledger of repo / agent-setup capabilities **deliberately not built yet**, each with the trigger that should wake it. A fresh template instance is typically pre-code, solo, and client-side, so most tooling a mature repo carries would have nothing to act on yet — no dependency graph to scan, no UI to guard, no deadline to age against. This file records *why* each deferred thing is absent and *what* should bring it back, so a deferred item resurfaces when its trigger fires instead of being silently forgotten or re-litigated.

Scope: the repo's tooling, CI, agents, skills, and process scaffolding. Not a product backlog — features/tools live in issues and [`DESIGN.md`](DESIGN.md), not here.

This file is itself drift-prone, so it sits in the [`AGENTS.md`](AGENTS.md) "Keeping docs and drift-prone files current" Update Triggers logic: when a process or roadmap change fires or retires one of the triggers below, reconcile this file in the same PR. A row whose trigger has already fired but is still parked under "Deferred" is a finding — raise it the way that section says (a non-blocking IMPORTANT note, never a merge blocker). Don't restate `AGENTS.md`, `DESIGN.md`, or `SECURITY.md` here; cross-reference them.

How to use a row: each is `Item | Trigger that should wake it | Why deferred`. Add a row when you consciously skip a capability that a future state will need; strike it through and annotate **WOKEN** (with a date) when its trigger fires and you build the thing in the same PR; delete it only once the woken note has outlived its usefulness.

---

## Deferred (build when the trigger fires)

The ledger starts **empty for a fresh instance** — there is no inherited backlog to carry. Populate it as you make deliberate deferral decisions for *this* product (e.g. dependency-hygiene tooling once a `package.json` and lockfile land, a commit-gated lint hook once there is shipping code, additional repo agents/skills once they exist). Until then there is nothing parked here.

| Item | Trigger that should wake it | Why deferred |
| --- | --- | --- |
| **Flip repo to public** (unlocks the free public tiers: CI minutes, branch-protection rulesets, Secret Scanning + Push Protection, dependency/code scanning) | **Before enabling CI e2e tests** — when the first workflow needs free public-repo CI minutes | **WOKEN 2026-06-22** — flipped early by choice (ahead of the CI-e2e trigger) once the pushed history was confirmed secret-clean by an independent scan. *(Was: kept private through pre-code build; the flip is a visibility toggle, not a scrub.)* |
| **Branch-protection ruleset on `main`** (require PR + 1 review by `@julianken-bot`, dismiss-stale approvals, require the `validate` check, block force-push, linear history) | The public flip (above), or a GitHub Pro upgrade | **WOKEN 2026-06-22** — ruleset applied at the flip. *(Rulesets/branch protection require Pro or a public repo — they 403 on a free private repo; the payload was held ready and applied once public.)* |
| **Secret Scanning + Push Protection** | The public flip (above) | **WOKEN 2026-06-22** — enabled at the flip as defense-in-depth behind the `.gitignore` gate. *(Free on public; needs paid GHAS on a private repo.)* |
| **Dependabot alerts + security updates** | The first `package.json` / lockfile (or any dependency manifest) lands | Nothing to scan pre-code — no dependency graph yet. Free + zero-config on public repos once a manifest exists. |
