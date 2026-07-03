# Optional module — Figma design system (source of truth, agent-synced)

**Optional.** This module is enabled by setting `mFjP4XMgcvdwzloZL9EMze` (a blank value disables it). When enabled, the product's design system lives in a Figma file that agents both **read AND write** over the Figma MCP, keeping it in **lockstep** with the shipped UI. A template consumer whose design source of truth isn't Figma can skip this entirely — the design source of truth is then [`DESIGN.md`](../../DESIGN.md), which **wins on any design conflict** regardless of whether Figma is in the picture.

This doc is the *adopt-or-skip* narrative. It is **not** the source of truth for *this product's* Figma file ID or node map: those are instance facts in [`INSTANCE.md`](../../INSTANCE.md) → "Design / Figma (source of truth, agent-synced)". Don't restate the file key or node-ids here — point at `INSTANCE.md`, which is where they're maintained (and which the Update Triggers table keeps current when frames are renamed or reordered).

## How Figma is used here

- **Agent-synced (read AND write).** Agents read the Figma file via the MCP read tools (`get_metadata`, `get_design_context`, `get_screenshot`, `get_variable_defs`, `get_code_connect_map`, `get_libraries`, `search_design_system`, `whoami`) **and write it** via the write tools (`use_figma`, `create_new_file`, `generate_figma_design`, `upload_assets`, `add_code_connect_map`) to keep it in lockstep with the shipped build. **Any frontend change keeps the matching frame(s) in lockstep, agent-authored** — for an issue-driven change the frame is authored/updated at the **issue stage** (design-first, pre-code-gated by [`.claude/skills/reviewing-figma-designs/`](../../.claude/skills/reviewing-figma-designs/SKILL.md), referenced in the issue body) and the build PR implements to it, reconciling Figma only if the build diverges; an issue-less PR authors the frame in that same PR. Two instances (Arabic + Chinese) share one design system via the Figma CORE library, so a change to a shared surface keeps **both** instances' matching frame(s) in lockstep. The `figma-design` skill ([`.claude/skills/figma-design/SKILL.md`](../../.claude/skills/figma-design/SKILL.md), the pre-code `phase-3-figma-design` BUILD stage — it writes to a feature's `WIP / {featureSlug}` page) is still valid: it is now **one path** within this agent-sync rule, not the sole exception. The prior read-only / human-only-edits rule is RETIRED (it caused the file to silently drift out of sync with the build). See AGENTS.md → "Design source of truth" + the Update-Triggers Figma row.
- **Authority on conflict: shipped build > `DESIGN.md` > Figma.** Figma is the *visual* source of truth and is kept in lockstep, but `DESIGN.md` §0 (with its `tokens.json` machine mirror) is the token source of truth, so on a genuine *value* disagreement the build then `DESIGN.md` still win: a Figma value that disagrees with `DESIGN.md` is drift to reconcile into `DESIGN.md` §0 (and `tokens.json` + the Figma CORE library modes, then back into the frame) in a PR. Never build straight from a live Figma node, and never paste its raw hexes/Tailwind — translate to `DESIGN.md` tokens. The ranking only breaks a momentary tie; the lockstep duty (above) is what keeps the two from drifting apart, so they no longer "do not auto-sync."
- **Flow:** for a known node call `get_design_context` directly; for a large/unknown subtree call `get_metadata(<node>)` first to scope, then `get_design_context`; use `get_screenshot` for visual reference. A URL's `?node-id=<n-n>` is the tool's `nodeId: <n:n>` (hyphen → colon).

The file ID, the page/screen node map, and the MCP quirks specific to *this* file are catalogued in [`INSTANCE.md`](../../INSTANCE.md).

## Plan limits (this file, today)

On the current Figma plan, **live Variable reads and Code Connect are unavailable** (`get_variable_defs` returns `{}`). Treat Figma as **visual reference, not a token feed** — the tokens come from `DESIGN.md`, not an MCP variable read. The `get_metadata`-with-no-node-id quirk (it lists only the Cover) means you always pass an explicit node-id from the `INSTANCE.md` node map.

## Adopt

1. Record your Figma file ID and node map in `INSTANCE.md` → "Design / Figma (source of truth, agent-synced)" (the instance source of truth — not in this doc).
2. Connect the Figma MCP and confirm the **read AND write tools** resolve (`whoami`, then `get_metadata` against a known node-id; and that the implementer/issue-authoring dispatch carries the write tools — otherwise use the `Figma update deferred — no MCP write access` fallback, `AGENTS.md` → "Live-state note").
3. Keep the **agent-sync rule** (an issue-driven frontend change authors the frame design-first at the issue stage and the PR reconciles it on divergence; an issue-less frontend PR authors the frame in that same PR — via the MCP write tools) and the `build > DESIGN.md > Figma` *conflict* ranking — together they keep Figma in **lockstep** with the build while preventing a live Figma value from silently overriding the shipped design.
4. Add the node-map-drift row to the Update Triggers table so node-ids stay current (this repo already has it).

## Skip

If your design source of truth isn't Figma, remove the "Design / Figma" section from `INSTANCE.md` and don't connect the Figma MCP. `DESIGN.md` remains the design source of truth on its own — nothing in the core process depends on Figma being present.
