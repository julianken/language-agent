# INSTANCE.md

<!-- INSTANCE FACTS for this specific product/repo: what it is, its GitHub identity,
its (optional) Figma design file, and its (optional) merge/review infra. AGENTS.md is
the source of truth for PROCESS (how agents work); this file is the source of truth for
INSTANCE (which product, which repo, which Figma file, which merge setup). DESIGN.md
remains the source of truth for design. Keep process rules out of this file — they belong
in AGENTS.md so the process shape stays portable across products. -->

## What this is
language-agent — an AI agent that teaches you to read Modern Standard Arabic through a conversation that blends English and Arabic. Built largely by AI coding agents through reviewed, squash-merged PRs.

## Status
**Status: in design — pre-code.** No `package.json`, app build, run, or test command exists yet — agents must not claim one (`AGENTS.md` → "Agent guardrails" → anti-invention); such commands get added to `AGENTS.md` → "Working in the tree" *when they exist*. What IS live from genesis: the repo-scaffolding gate — the `scaffolding` CI workflow (`.github/workflows/scaffolding.yml`) and the `scripts/` guards (`check-claude-shim.sh`, `validate-scaffolding.sh`, `check-concept-drift.sh`) run and are required. The product is fully specified (`DESIGN.md` + the Figma file + `docs/plans/`); implementation hasn't started. `DEPLOY_URL` (`https://language-agent.pages.dev`) is the *planned* Cloudflare Pages target — **not yet deployed**.

## Repo identity
Local folder `language-agent/`; GitHub slug `julianken/language-agent` — they may differ, so pass the slug to `gh`. Default branch `main`.

## Design / Figma (OPTIONAL — delete this whole section if mFjP4XMgcvdwzloZL9EMze is blank)

`DESIGN.md` is the source of truth for design (see AGENTS.md → "Design source of truth" for the authority ranking). The instance facts about *this product's* Figma file live here.

The design system lives in Figma (file `mFjP4XMgcvdwzloZL9EMze`). Read it via the Figma MCP **read tools only** — `get_metadata`, `get_design_context`, `get_screenshot`, `get_variable_defs`, `get_code_connect_map`, `get_libraries`, `search_design_system`, `whoami`. **Never** call a write tool (`use_figma`, `create_new_file`, `generate_figma_design`, `generate_diagram`, `upload_assets`, `add_code_connect_map`) against the **canonical design** — the system pages (Foundations, Components, Screens, States, Motion, Annotations) and every canonical design frame are **human-only**: agents read them; a human edits them. **One narrow, documented exception:** the `figma-design` skill (`.claude/skills/figma-design/SKILL.md`, the pre-code `phase-3-figma-design` BUILD stage) may use Figma write tools, but **only** through its scoped WIP/scratch-page workflow — it writes exclusively to a feature's `WIP / {featureSlug}` work-in-progress page and **never** touches a canonical design frame or system page. Outside that one skill's scoped WIP writes, the write-tool ban above is absolute.

**Authority:** shipped build > `DESIGN.md` > Figma. `DESIGN.md` wins on any design conflict; a live Figma value that disagrees with it does **not** bind the build — it's *drift to reconcile into `DESIGN.md` in a PR*. Never build straight from a live Figma node, and don't paste its raw hexes/Tailwind — translate to `DESIGN.md` tokens. The two do not auto-sync.

**Flow:** for a known node call `get_design_context` directly; for a large/unknown subtree call `get_metadata(<node>)` first to scope, then `get_design_context`; use `get_screenshot` for visual reference. A URL's `?node-id=<n-n>` is the tool's `nodeId: <n:n>` (hyphen → colon).

**Node map.** The canonical design spans these pages (node-ids in tool form `<n:n>`; the URL form replaces the colon with a hyphen: `https://figma.com/design/mFjP4XMgcvdwzloZL9EMze/?node-id=<n-n>`). **v3 is the current design**; the v1/v2 pages are retained as history.

| Page | node-id | What |
| --- | --- | --- |
| `v3 · Overview` | `90:2` | Index + the locked vocabulary-system summary |
| `v3 · Feature Screens` | `67:2` | The 5 surfaces (container `67:3`) — sub-nodes below |
| `v3 · User Journey` | `81:2` | High-level 3-layer journey map |
| `v3 · User Flows` | `86:2` | End-to-end navigation; v3 deltas highlighted |
| `v3 · Storyboards` | `88:2` | New-interaction state storyboards |
| `v2 · App Flow (End-to-End Journey)` | `42:2` | v2 end-to-end screens (history) |
| `v2 · Journeys, Stories & Motion` | `22:2` | v2 motion + journeys (history) |
| `brainstorm-v2` | `9:2` | 7 deep feature mocks 01–07 (history) |
| `brainstorm-v1` | `0:1` | Earliest exploration (history) |

v3 Feature-Screen sub-nodes (children of `67:3`): curriculum road `69:2` · word-state inspector `70:2` · deep calibration `72:2` · operator dashboard `73:2` · chat `77:2`.

Node-ids are drift-prone (a frame rename/reorder can renumber them) — the AGENTS.md Update-Triggers row, not the ids, is the safety net. If live Variable reads and Code Connect are unavailable on this Figma plan (`get_variable_defs` → `{}`), treat Figma as visual reference, not a token feed.

## Product concept (canonical noun)

<!-- The SOLE place this product's vocabulary lives. `scripts/check-concept-drift.sh`
and the `.claude/skills/reviewing/` concept-drift pass READ this block and contain NO
product words — so the same portable check works for every instance. This is a fresh
instance — the canonical noun is set below, and no retired terms are declared yet; the
`RETIRED-TERM` sentinel keeps the drift gate inert until the first real refocus. -->

A product accretes vocabulary as it evolves; when it **refocuses** (its core abstraction is renamed, or a direction is abandoned), stale copy describing the *old* shape can silently recur on the live surfaces a user or the LLM reads as a present-tense product claim. This block pins what the product currently IS so the drift check can catch the rest. See `AGENTS.md` → Update-Triggers (the concept-refocus row) and the `DORMANT:` / `RETAINED:` tag spec.

- **Canonical noun** — the one word for what the product currently IS. One greppable line.
  - `CANONICAL-NOUN: language-agent` *(replace `language-agent` with the live core-abstraction noun at refocus time, e.g. the thing the product produces today)*
- **Retired terms** — words/phrases that describe an *abandoned* shape and must no longer appear as the live product description. One `RETIRED-TERM:` per line, literal-minded (matched case-insensitively, no NLP — a multi-word phrase is fine). The term is read from the text after the marker, up to the first backtick / `<!--` / `*` / `(`, so a line may carry a per-line `concept-drift-ok:` escape (inside an HTML comment) and the retired-terms list won't self-trip the check. This list starts as a neutral sentinel on the bare template; the check treats `REPLACE-AT-BOOTSTRAP` (and any unreplaced placeholder token) as "not declared yet" and stays inert. Replace it with the product's actual retired terms when a refocus happens (a fresh product has none — leave the sentinel).
  - `RETIRED-TERM: REPLACE-AT-BOOTSTRAP`  <!-- concept-drift-ok: the retired-terms list itself --> *(replace `REPLACE-AT-BOOTSTRAP` with a real retired term, e.g. the abandoned core abstraction; keep the `concept-drift-ok:` escape on the line)*
- This block is the **only** place a product's vocabulary lives. The check script and the reviewer pass read these `CANONICAL-NOUN:` / `RETIRED-TERM:` lines and embed no product words of their own.

The sanctioned escape hatch for a legitimate retired-term mention (history, a deliberately-retained path, a route/code identifier, a roadmap north-star) is a per-line `DORMANT:` / `RETAINED:` / `concept-drift-ok: <reason>` tag — defined in `AGENTS.md` → "DORMANT / RETAINED tag spec".

## Merge / review infra (OPTIONAL — trim to what this repo actually uses)
- **Mergify** (`.mergify.yml`): an approved PR squash-merges through the queue via a standalone `@Mergifyio queue` comment. The merge *method* and its invariants are process — see `.claude/skills/pr-workflow/SKILL.md` and the user-level `mergify-merge-workflow` skill. *(Delete this bullet if the repo does not use Mergify.)*
- **`@julianken-bot` is the sole non-author reviewer** *(OPTIONAL — delete this bullet if julianken-bot is blank)*. Direct push to `main` is blocked by a GitHub ruleset requiring 1 fresh approving review per HEAD from a non-author collaborator; the owner (`@julianken`, the lone code owner in `.github/CODEOWNERS`) authors PRs and can't self-approve, so `@julianken-bot` — the only other collaborator — is what unblocks merge.
