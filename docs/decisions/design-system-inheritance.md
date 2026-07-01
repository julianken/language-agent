> **ADR — Status: Accepted · 2026-06-29** (user-confirmed; the `decisions-log.md` entry is `LOCKED`). **Decision:** adopt a *CORE published Figma library + per-language consumer files* topology with a three-tier variable model (Primitives → Semantic → `Locale`[N modes]); carry **value deltas** (font, numerals, leading) as `Locale` modes and **structural deltas** (direction, annotation anatomy, input method) as components/variants/slots — never modes; and mirror the system in a machine `tokens.json` SoT with `DESIGN.md` §0 as the human mirror. Produced by the `design-system-inheritance-research` workflow (6 research angles + synthesis); the full architecture, migration, and risks follow. **Supersedes** the implicit "hand-build each instance" approach that produced the Chinese frames as hard-coded orphans (zero shared variables/components).

# Design-system inheritance — one system, N language instances

> Status: accepted (research-grounded architecture). Grounds the research on multi-instance Figma inheritance against this product's verified state — `DESIGN.md` §0 (28 color tokens, 14-token type ramp, 9-step spacing, 8 radii, 8 motion tokens, 4 elevation levels), the Arabic Figma file (`mFjP4XMgcvdwzloZL9EMze`: Colors[28] + Scale[17], one "Mode 1", zero components), and the Chinese file (zero variables / styles / components, every value hard-coded).

## 0. The core insight: we are a *low-divergence, locale-axis* system

The multi-brand literature is built for the case where the **color/brand layer** diverges and you fight to contain blast radius. We are the inverse. Across Arabic and Chinese the canvas (`canvas` #fbf9f4), the scarce teal + gold (`primary` #0f766e, `accent-gold` #b8860b), the status washes (`status-new` gold / `status-learning` teal / `status-known` bare), spacing, radii, motion, elevation, the conversation-first 3-column layout, the click-a-word card, the fade-as-progress mechanic, the margin channel, and the write+correct surface are **identical**. ~90% of `DESIGN.md` §0 is script-neutral and should be authored exactly once.

What actually diverges is a thin **script layer**, and it splits cleanly into two *kinds* that demand two *different* mechanisms:

| Kind | Deltas | Carrier | Why |
|---|---|---|---|
| **Value deltas** (tokenizable) | subject font-family (Amiri ↔ Noto Serif TC), annotation/romanization font, numeral system (Eastern Arabic-Indic ٠-٩ ↔ Western), script-sensitive line-height/leading | **a `Locale` variable collection, one mode per language** | These are the same property resolving to a different value. font-family became a bindable string variable in Figma's 2024 typography-variables release, so this is a clean mode swap. |
| **Structural deltas** (NOT tokenizable) | text DIRECTION (RTL ↔ LTR) + its layout mirroring; phonetic annotation *anatomy* (ḥarakāt inline-on-glyph + shed-as-progress ↔ pinyin ruby-above-glyph + tone-contour cue); input surface (glyph keyboard ↔ pinyin IME + candidate bar); breakdown (root+pattern ↔ radical/character) | **component variants / slots / separate components** | Modes re-bind *values* on the same layers; they cannot change which layers exist or which component renders. Forcing structure into a mode is the "mode too far" anti-pattern. |

Everything below follows from that split. The one hard wall is **direction**: Figma has no `textDirection` variable and no plugin-API property for paragraph direction, and auto-layout does not auto-mirror — so RTL/LTR can never ride the Locale mode and must be handled structurally.

## 1. Target architecture

### 1.1 Topology — one CORE library, per-language consumer files

Figma has **no cross-file component inheritance**: a component in the Chinese file can never be a child of a master in the Arabic file; you cannot push changes to a component that lives in another file. The only cross-file mechanism is a **published library consumed as instances**. So "Chinese extends Arabic" is impossible. The correct shape is a *third*, script-agnostic file:

```
CORE library (NEW, script-agnostic, published)
├── Variables
│   ├── Primitives   (raw values, 1 mode)     ← Arabic Colors[28] + Scale[17] re-keyed here
│   ├── Semantic     (role aliases, 1 mode)   ← status washes, surfaces, brand, correction
│   └── Locale       (deltas only, N modes)   ← ar | zh | … ; font/subject-family, numerals, leading
├── Text styles (the shared type ramp: sizes/weights, bound to Locale font vars)
└── Components (the shared shells, built once)
        app-shell · tool-rail · conversation-spine · margin-channel
        bubble-assistant · bubble-learner · WordCell(base) · WordCard(shell)
        word-card-popover · margin-note-* · compose-bar · buttons · pills · text-input
                    │  publishes ▼
        ┌───────────┴────────────┐
  Arabic file (consumer)    Chinese file (consumer)
  subscribes CORE           subscribes CORE
  Locale mode = ar          Locale mode = zh
  + leaf components:        + leaf components:
    HarakatUnit               PinyinRubyUnit(+tone-contour)
    RootPatternBreakdown      RadicalBreakdown
    GlyphKeyboard             PinyinIME + CandidateBar
  + RTL pass                 (LTR native)
```

A consuming file can **apply a subscribed library collection's mode locally** (select the root frame → Apply variable mode → pick the remote `Locale` mode), provided at least one variable from that collection is actually used on/under the layer. So consumers redefine nothing on the token side — they pin their root to `Locale=ar` / `Locale=zh` and the whole tree resolves. (Adding a *new* language mode happens in CORE, which is where you'd add it anyway.)

**Why this over "one big file with all locales switched by mode" (Option A):** Option A maximizes the pure modes-as-inheritance demo but (a) you ship per-locale *apps*, not one switchable artifact; (b) modes publish org-wide and can't be QA'd privately — a locale-in-progress leaks to all consumers; (c) one giant file gets unwieldy. Option B (CORE + consumers) maps to today's already-separate files and is the recommendation. Keep Option A only in mind as a fallback if you ever want a single switchable showcase with very few locales.

### 1.2 The variable / mode model — what is shared vs overridden

Three tiers, **single-hop aliasing** (semantic → primitive; never semantic → semantic → primitive — chaining makes the graph brittle).

**Tier 1 — Primitives (1 mode, shared):** every raw literal from `DESIGN.md` §0 that is script-independent — the teal/gold/paper hexes, the 4px spacing scale, radii, motion durations/eases, elevation, and the type *sizes*/weights. This is exactly the Arabic file's existing Colors[28] + Scale[17]; **those values are 100% reusable** — you re-key them into CORE, you do not re-derive them. They were always primitives; today they're just bound straight to frames with no semantic indirection.

**Tier 2 — Semantic (1 mode, shared):** role-named aliases of primitives — `status-new-bg`/`status-learning-bg`, `surface-card`/`surface-soft`/`surface-strong`, `primary`/`accent-gold`, `correction-add`/`correction-remove`, `confidence-uncertain`. Frames bind to *these*, never to a primitive directly. This is the indirection both files lack today and the reason a future dark mode or a token fix can land "for free" in the gap between tiers without touching a single frame.

**Tier 3 — Locale (N modes, deltas only):** the *only* collection with one mode per language, holding *only* what varies:

| Locale variable | `ar` value | `zh` value | Type |
|---|---|---|---|
| `font/subject-family` | `Amiri` | `Noto Serif TC` | string |
| `font/annotation-family` | `JetBrains Mono` (translit.) | a pinyin-capable family | string |
| `numeral-system` | Eastern Arabic-Indic | Western | string/enum |
| `leading/subject-reading` | `1.95` (ḥarakāt clearance) | tuned for ruby top-reserve | float |
| `leading/annotation-reserve` | (in-glyph, ~0) | ruby sits *above* the glyph | float |

Note the UI chrome font (`Inter`) and the shared semantic colors are **not** in Locale — they're one value across all modes. The annotation *color* (`muted`/`muted-soft`) is likely shared too; only its *family* and *vertical geometry* diverge.

> Put `Locale` in its **own** collection, isolated from any future `Theme` (light/dark) or `Density` axis. Modes resolve per-collection independently, so separate collections **add** rather than **multiply** — 10 languages in `Locale` + 2 themes in `Theme` = 12 mode-columns total, not 20. Cramming language × theme into one collection is what burns the plan's mode cap.

### 1.3 The component set — variant/prop vs slot vs separate component

The decisive heuristic, to be encoded as a rule in `DESIGN.md`:

- **Same anatomy, only value/visibility/state differs → variable (mode) or variant / boolean / text property.** Status (`new`/`learning`/`known`) is a **variant axis** on the base `WordCell`; fade-as-progress is a **bound opacity variable** on it; font-family is a **Locale variable**. Built once, shared by all languages.
- **Same container hosts language-specific content → SLOT or instance-swap with preferred values.** The annotation region of `WordCell` and the breakdown region of `WordCard` are the *same container* per language but hold different leaves. Expose a slot/swap whose **preferred values** are exactly `{HarakatUnit, PinyinRubyUnit}` and `{RootPatternBreakdown, RadicalBreakdown}` so consumers see a constrained, on-system menu.
- **An extra subsystem / layers that exist in one language only → SEPARATE component.** The pinyin IME's **candidate bar** is a whole selection/scroll subsystem the Arabic glyph keyboard has no layer for. `GlyphKeyboard` and `PinyinIME+CandidateBar` are **separate components**; only the dock chrome + tokens are shared. Forcing them into one variant set is the classic over-component trap (and the swap dropdown can't even preview them).

Applied to our inventory:

| Surface | Treatment | Carrier |
|---|---|---|
| app-shell / 3-column, tool-rail, conversation-spine, margin-channel, bubbles, compose-bar, buttons, pills, text-input, persona-header, margin-note-* | **Shared shell**, built once in CORE, bound to Semantic + Locale vars | instances placed per consumer |
| `WordCell` base (hit target, status wash, fade-opacity) | Shared shell; **status = variant axis** | one component, all languages |
| word annotation (ḥarakāt ↔ pinyin ruby + tone-contour) | **Slot / instance-swap** on `WordCell` | leaf per language |
| `WordCard` breakdown (root+pattern ↔ radical) | **Slot** on `WordCard` shell | leaf per language |
| input surface (glyph keyboard ↔ pinyin IME + candidate bar) | **Separate component** per language | shared dock chrome only |
| `vowel-slider` (Full/Minimal/Off) | Shared "annotation-density control" shell; per-script **labels = text/variant** (Arabic ḥarakāt density; Chinese ruby density) | one shell, per-language labels |
| text direction + layout mirroring | **Structural**, not a mode (see 1.4) | consumer-file layout + variant |

> **Never make `language` a variant axis on a shared master.** Toggling any variant/boolean **resets nested-instance overrides** to defaults — a `Lang=AR/ZH` property on a master that *also* carries the status variants would silently wipe the per-language content every time status toggled. Language must live where it is *stable*: in the consumer file's slot-fill / swap choice / applied mode — never as a variant property. Keep `status` and `fade` as the variant/state axes; keep `script` as a slot fill or a separate leaf.

> **Keep the swappable boundary shallow.** Nested-component + moded-variable interaction is buggy (switching a mode on a deeply nested instance can reset other overrides and skip icon-size updates). Don't rely on one mode flip cascading through 3+ nesting levels; design the annotation/breakdown leaves to be **self-contained** (their own text + tone-contour controls), because once a leaf sits in a slot you can't expose its props from the card's top-level panel anyway.

### 1.4 The RTL/LTR + font-per-locale handling (explicit)

**Font-per-locale = clean token.** One `font/subject-family` string variable, `Amiri` in `ar`, `Noto Serif TC` in `zh`, bound into the shared text styles. Caveats to verify before relying on it: a bound font-family **silently no-ops** if the font isn't actually present in the file or isn't typed verbatim; full variable overrides *inside* text styles are still gappy, so you may need the string variable bound at the layer or parallel per-script text styles. Any migration plugin must `loadFontAsync` **every** mode's font value (Amiri *and* Noto Serif TC) **before** `setBoundVariable('fontFamily', …)` / `setValueForMode` / `setExplicitVariableModeForCollection`, and the sandboxed MCP/plugin font model may not surface locally-installed fonts that the Figma renderer can see — check `figma.listAvailableFontsAsync` and `text.hasMissingFont` first.

**Direction = the hard wall, handled structurally.** There is no direction variable and no plugin property; auto-layout does not mirror. So:
- *In Figma:* model direction at the **component/consumer-file** level — auto-layout `start`/`end` alignment (not left/right), a one-time **RTL-Converter / RTL Layout** plugin pass on the Arabic file to flip the 3-column order, the margin-channel side, and directional icons. Where mirroring is genuinely structural on a shared shell, an `rtl/ltr` boolean variant is acceptable — but budget manual work; this is not a clean single flag. (`DESIGN.md` already states "the shell chrome reads LTR; the conversation *content* reads RTL" and wraps every token in a bidi isolate U+2066–2069 — that discipline carries forward.)
- *In code (the analog):* CSS **logical properties** (`margin-inline-start`, `inset-inline`, `text-align: start|end`) + `dir`/`lang` on the root, so one stylesheet serves both. Expect to still need conditional `[dir=rtl]` overrides for directional icons, shadow/transform offsets, and some background positions — mirror that expectation in `DESIGN.md` so design and code stay honest.

## 2. The doc-layer mirror

The Figma structure must be mirrored in docs, or the docs reintroduce the drift the variables kill.

- **`DESIGN.md` becomes the system-level SoT, script-neutral.** Today it is Arabic-specific (it names Amiri, ḥarakāt, MSA, Eastern Arabic-Indic numerals). Refactor it to own, *once*, the shared system: the 28 colors, the type *ramp* (sizes), spacing, radii, motion, elevation, the shared component **anatomy** (app-shell, conversation-spine, margin-channel, WordCard shell, write+correct surface), the **fade-as-progress mechanic**, the status semantics (new/learning/known), and the journeys/flows/motion patterns — in script-neutral vocabulary: "subject script", "phonetic annotation", "input surface", "scaffold-fade". This is the doc analog of CORE.
- **Each instance carries only a thin "Script-layer deltas" table** — the doc analog of a `Locale` mode + its variant set. Natural home: `INSTANCE.md` (its per-repo convention). It holds *only* deltas: subject font, text direction, the phonetic-annotation mechanic (ḥarakāt-shed ↔ pinyin-ruby + tone-contour), numerals, the divergent input surface, script-sensitive leading. The repo's existing **no-drift rule already forbids restating `DESIGN.md`** there, which is exactly the discipline we want — deltas only.
- **Add a machine SoT to kill the two-source problem.** Author a **W3C DTCG `tokens.json`** (the spec hit a stable 1.0 in Oct 2025; `$type`/`$value`/`$description` + `{alias}` references) with the Primitives + Semantic tiers and per-language override sets. Figma's native W3C variable import/export (rolling out late 2025) reads it; this is the bridge that lets the Chinese file *consume* tokens instead of hand-rebuilding. `DESIGN.md` §0 becomes the human-readable mirror of `tokens.json`, and §0's own rule ("build wins; reconcile this file to match it") means the generated build is the literal source. For a plan-independent path, the same layering is expressible as **Tokens Studio** "Source" sets (Primitives marked Source so cross-set refs resolve) built with **Style Dictionary** (`@tokens-studio/sd-transforms`) — which *enforces* "shared" at build time rather than by copy-paste, directly fixing today's hard-coded-Chinese state.
- **`journeys` / `flows` / `motion`** follow the same rule: the *patterns* live once in `DESIGN.md` (the motion section already binds to the §0 token set and points at `docs/plans/motion-spec.md`); only a per-instance delta (e.g. "Chinese annotation reveals ruby above the glyph; Arabic sheds ḥarakāt in place") sits in the instance doc.

## 3. Migration — from today's state, in dependency order

Reusability up front: **the Arabic Colors[28] + Scale[17] values are the reusable asset** — they are already-correct, script-neutral primitives. The migration *re-homes and restructures* them (flat → Primitives + Semantic), it does not re-derive them. The Arabic file's hand-built, token-bound frames are the cheaper consumer to convert; the empty Chinese file is the long pole and must be **reconstructed**, not incrementally linked.

0. **Confirm the Figma plan and fonts (gates everything).** The Arabic file having exactly one "Mode 1" and zero extra modes is the signature of **Starter/Free**, where modes *cannot be created at all* — the entire script-as-a-mode architecture is unbuildable until upgrade. Verify the plan; upgrade to at least **Professional** (≈10 modes/collection; Organization ≈20; Enterprise extended/effectively unlimited — and note Figma has revised these caps repeatedly, so older "4-mode" guidance is stale; verify against current pricing). Confirm both `Amiri` and `Noto Serif TC` are available to the files (`listAvailableFontsAsync`).
1. **Author the machine SoT (`tokens.json`).** Encode Primitives (every script-neutral hex/size/space/radius/duration/ease) + Semantic aliases, single-hop. Decompose any composite typography into separate fontFamily/fontSize/fontWeight/lineHeight primitives (Figma variables are scalar; composite type tokens have no single-variable equivalent). Commit it; make `DESIGN.md` §0 its human mirror.
2. **Stand up the CORE library file; recreate the variables there.** Build Primitives + Semantic collections from `tokens.json` (native W3C import) — **don't expect to drag variables between files; bindings don't survive the move**, so recreate via import / a plugin / the Variables REST API, then rebind. Lock a **naming convention now** (Swap Library matches by name; a mismatch later won't map).
3. **Add the `Locale` collection in CORE.** Mode `ar` populated from the Arabic file's current values; mode `zh` stubbed; room to grow. Variables = the Tier-3 delta set only (font/subject-family, font/annotation-family, numeral-system, the script-leading floats).
4. **Componentize the shared shells in CORE** (the prerequisite both files lack — without it, modes only re-skin and structure never propagates). Build the base `WordCell` (hit target; fade-opacity bound to a Scale var; status wash bound to a Color var; **status = variant axis**), the `WordCard` shell with a **`breakdown` slot**, the 3-column `app-shell`, `margin-channel`, `compose-bar`/write+correct surface, bubbles, `vowel-slider`→annotation-density control, buttons, pills. Expose **slot / instance-swap with preferred values** on the script-divergent regions. Keep nesting shallow. Bind text to the shared text styles (which read `Locale` font vars).
5. **Publish CORE.**
6. **Re-found the ARABIC file as a consumer (cheaper — already token-bound).** Subscribe to CORE; swap local frames → library instances (Swap Library / a swap plugin preserves overrides); pin the root frame to `Locale=ar`; author the Arabic **leaf** components — `HarakatUnit` (annotation), `RootPatternBreakdown`, `GlyphKeyboard` — and drop them into the shell slots; run the **RTL-Converter** pass for direction/mirroring. This proves the consumer pattern end-to-end on the easy case.
7. **Rebuild the CHINESE file as a consumer (the long pole — reconstruct, don't retrofit).** It is empty of variables/styles/components and cannot be incrementally linked; treat its existing hard-coded frames as a **visual spec to match**, not a base to migrate. Subscribe to CORE; pin the root to `Locale=zh`; fill the ~5–8 `zh` delta values; author the Chinese leaves — `PinyinRubyUnit` (+ tone-contour), `RadicalBreakdown`, and the **separate** `PinyinIME + CandidateBar`; build screens from instances. It inherits canvas, teal+gold, status washes, spacing, radii, motion, and the 3-column layout for free.
8. **Reconcile the docs (same discipline as the code).** Refactor `DESIGN.md` to script-neutral system level; add the per-instance "Script-layer deltas" table to each `INSTANCE.md`; wire `tokens.json` ↔ `DESIGN.md` §0 ↔ Figma so the three never drift (one machine source, one human mirror, generated Figma/code).

## 4. The "add language N" cost after migration

Bounded and cheap — a thin override, never a rebuild:

- **+1 `Locale` mode in CORE** with ~5–8 delta values (subject font, annotation font, numerals, script-leading).
- **+1–3 leaf components** — and *only if* the script's annotation/breakdown/input is genuinely novel (a new abugida or a new IME). Many scripts reuse an existing leaf shape.
- **+1 consumer file** that subscribes to CORE and pins its root to the new mode.
- **+ a direction decision** (an RTL pass + logical-property `[dir=rtl]` overrides if the script is RTL; nothing if LTR).
- **Inherited for free:** all 28 colors, spacing, radii, motion, elevation, the type ramp, the journeys, and every shared shell (3-column layout, WordCell, WordCard, margin channel, write+correct, fade-as-progress).

Marginal cost ≈ *1 mode + N delta values + 0–3 leaves + 1 file + a direction pass* — versus today's full hand-build. The only ceiling is the plan's mode cap (keep `Locale` isolated so the cap applies to languages, not languages × themes).

## 5. Risks + mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | **Figma plan / mode cap.** The lone "Mode 1" signals Free, where modes can't be authored *at all* — the whole architecture is unbuildable; and the per-collection cap (Pro ~10 / Org ~20) ceilings language count. | Verify the plan in step 0 and upgrade to ≥ Professional *before* anything else. Keep `Locale` in its own collection so the cap counts languages, not language × theme × density. Verify current caps against Figma pricing (the old "4" is stale). |
| 2 | **Direction (RTL/LTR) is not tokenizable** and auto-layout doesn't mirror. | Treat as structural: auto-layout `start`/`end`, a one-time RTL-Converter pass on the Arabic file, an optional `rtl/ltr` shell variant where mirroring is structural; in code, CSS logical properties + `dir`/`lang` with conditional `[dir=rtl]` overrides for icons/shadows. Never model direction as a mode. |
| 3 | **Divergence too big for a mode** — annotation anatomy and the IME/keyboard are structural. | Modes carry value deltas only; structure goes to variants / slots-with-preferred-values / separate components. Apply the §1.3 decision matrix; the candidate-bar IME is a *separate* component, not a variant of the glyph keyboard. |
| 4 | **Over-componentization** — cramming keyboard+IME into one variant set, or over-fragmenting `WordCell`. | Match the seam to where anatomy actually diverges: `WordCell` shell is shared, only its annotation swaps; the input surfaces are separate components. |
| 5 | **No cross-file component inheritance; variables don't move cleanly; Swap-by-name is fragile.** | CORE-first topology (consumers, not a fork); recreate variables via W3C import / REST API / plugin and rebind; lock the naming convention before migrating so Swap Library maps. |
| 6 | **Language-as-variant override-reset bug** — toggling a variant wipes nested overrides. | Language lives in the consumer's slot-fill / swap / applied mode, never as a variant property; keep `status`/`fade` as the only variant axes; keep nesting shallow. |
| 7 | **font-family bind silently no-ops; plugin font loading is sandboxed.** | Type names verbatim; ensure both fonts are present in the file; `loadFontAsync` every mode's value before any bind/mode-switch; check `hasMissingFont` / `listAvailableFontsAsync`; test binding through a text style vs at the layer (a known "styles don't respect mode" bug). |
| 8 | **Doc/token drift across three sources** (`DESIGN.md` §0, `tokens.json`, Figma). | One machine SoT (`tokens.json`), `DESIGN.md` §0 the human mirror, Figma + code generated from it; the AGENTS.md update-trigger table already enforces same-PR reconcile. |
| 9 | **Betas/gating:** Extended Collections are Enterprise-first (Schema 2025, Nov 2025); Slots are open beta (≈2026-03) with real limits (can't be a top-level layer; can't expose props of slot-nested instances; an override breaks the parent cascade). | Don't architect *solely* on extended collections — use plain modes / Tokens Studio Source sets as the plan-independent path and treat extended collections as an enhancement. Design slot-leaves self-contained; fall back to instance-swap-with-preferred-values if slots are too green. |
| 10 | **Shared blast radius / no private QA for modes** — a bad base-token edit ships to every language at once; library updates can break consumer overrides. | This is mostly a *feature* here (we *want* a token fix to hit both languages), but version/branch CORE before token surgery; keep consumer overrides minimal and token-bound so a CORE update re-flows instead of fighting hand overrides. |

## 6. Phasing — most leverage first, given Chinese frames already exist hard-coded

- **Phase 0 — Gate (~½ day).** Confirm Figma plan + font availability. Cheap; unblocks everything. *Do this before promising any of the rest.*
- **Phase 1 — Token SoT + CORE foundations (highest leverage, ~2–3 days).** Author `tokens.json`; stand up CORE Primitives + Semantic from the Arabic vars. This is the single biggest payoff: it's what lets the Chinese file stop inheriting nothing, **independent of any componentization** — even before shells exist, both files can re-skin from one shared token source. It also converts the flat Colors[28] into the tiered graph that makes future theming free.
- **Phase 2 — Shells + Locale (~3–5 days).** Componentize the shared surfaces in CORE and add the `Locale` collection with `ar`/`zh` modes. This is the prerequisite that makes inheritance **structural**, not cosmetic — without components, modes alone re-skin but every language still re-hand-builds frames.
- **Phase 3 — Arabic as consumer (~2 days).** Re-found the already-token-bound Arabic file against CORE. Proves the consumer pattern on the easy case and shakes out the cross-file mode-apply and Swap-by-name mechanics on familiar ground.
- **Phase 4 — Chinese as consumer (~4–6 days, the long pole).** Reconstruct the Chinese file against CORE: author the `zh` leaves + `PinyinIME+CandidateBar`, fill the deltas, build from instances. Use the existing hard-coded Chinese frames as a **target screenshot to match**, *not* as something to incrementally tokenize — don't sink effort into linking dead frames.
- **Phase 5 — Doc reconcile (~1–2 days).** Refactor `DESIGN.md` to script-neutral system level; add the per-instance "Script-layer deltas" tables; wire the `tokens.json` ↔ `DESIGN.md` ↔ Figma sync so the win doesn't rot.

After Phase 5, adding language #3 is the §4 cost: one mode, a handful of deltas, 0–3 leaves, one file, a direction decision — and the next language is genuinely cheap, not a rebuild.