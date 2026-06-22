# v2 Figma Build Plan — Journeys, Stories & Motion

> **Status: build-ready spec for a new Figma page.** This plans a *storyboard* page that documents the
> v2 user journeys as labelled rows of state mocks, with each arrow between states carrying the
> `transitions-dev` animation that plays and each state tagged with the user-story IDs it satisfies.
> It composes four existing artifacts and adds nothing new to the design language:
> the design system [`DESIGN.md`](../../DESIGN.md) (warm paper `#fbf9f4`, scarce teal `#0f766e`, manuscript
> gold `#b8860b`, Amiri/Inter/JetBrains Mono, status tints, RTL-first), the
> [`v2-design-plan.md`](./v2-design-plan.md), the user stories
> [`user-stories/user-stories.md`](./user-stories/user-stories.md) (epics E1–E8, 49 stories), and the
> [`motion-spec.md`](./motion-spec.md) (the transitions-dev mapping + §8 production rules).
> The seven anchor full-screen mocks (01–07) already exist on the `brainstorm-v2` page; this page mostly
> needs NEW compact state cards (~320–400px) for the transient/interaction states *between* them.

**New Figma page name:** `v2 · Journeys, Stories & Motion`

**Scope at a glance:** 6 journey storyboards · 45 state cards total · **35 NEW compact cards to build**
· 10 reuse-as-thumbnail references to the existing `brainstorm-v2` 01–07 screens · 1 story-index board
(E1–E8) · 1 motion legend (9 transitions-dev patterns).

---

## 1. Page layout (top → bottom)

The page is one tall warm-paper (`canvas #fbf9f4`) artboard, laid out as three stacked sections separated
by the 80px editorial section rhythm from `DESIGN.md §Layout`. Read it top-to-bottom: index → legend →
storyboards. Everything is on warm paper; chrome is LTR, any embedded Arabic token is RTL + bidi-isolated.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  TITLE BAND   "v2 · Journeys, Stories & Motion"   (latin-title-lg, ink)        │
│  subtitle: 6 journeys · 45 states · 35 new mocks · E1–E8 · transitions-dev     │
├──────────────────────────────────────────────────────────────────────────────┤
│  (A) STORY-INDEX BOARD — 8 epic columns E1…E8, must-have story title cards     │
├──────────────────────────────────────────────────────────────────────────────┤
│  (B) MOTION LEGEND — 9 transitions-dev patterns, each "where it's used"        │
├──────────────────────────────────────────────────────────────────────────────┤
│  (C) 6 JOURNEY STORYBOARDS — J1…J6, each a labelled horizontal row of state    │
│      cards with a transition-labelled arrow between every pair                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

### (A) Story-index board

A horizontal band of **8 labelled columns**, one per epic E1–E8, on `surface-soft #f3efe6` with a
`hairline #e4ddcd` divider between columns. Each column:

- **Header:** the epic id + name (`latin-title-md`, ink) — e.g. `E1 · Agent chat with web search`.
- **Body:** the epic's **must-have** story titles as small cards (`badge-pill` / `margin-note-gloss`
  geometry: `surface-card`, `rounded.sm`, `latin-body-sm`, body `#574f45`), each prefixed with its
  story id chip (`status-pill`, `surface-strong`, `latin-label`, muted). Tag any title that appears in a
  journey below with a tiny gold dot (`accent-gold`) so the index doubles as a coverage map.

| Col | Epic | Must-have story-title cards (id · short title) |
|---|---|---|
| **E1** | Agent chat with web search | US-1.1 useful answer in the blend · US-1.2 quiet tool-activity strip · US-1.3 web auto/always/never toggle · US-1.4 citations + source rail · US-1.5 inline word lookup · US-1.6 comprehension floor / never wrong Arabic |
| **E2** | Doc upload + grounded replies | US-2.1 upload & ask · US-2.2 which passage it came from · US-2.3 doc persists across turns · US-2.4 trust a doc answer I can't read |
| **E3** | Two-axis progression control | US-3.1 Words dial · US-3.2 Grammar dial (decoupled) · US-3.5 override + hold flavors · US-3.6 why-it-moved + approve-before-cross |
| **E4** | Structure-swap mode | US-4.1 Mode A (English words, Arabic order) · US-4.2 role-bands + redundant labels · US-4.3 reveal natural order |
| **E5** | Learning path — where am I | US-5.1 two honest tracks · US-5.2 why am I here (real data) · US-5.3 three-flavor thermostat · US-5.4 never silently drop · US-5.5 nudge only when ready |
| **E6** | The learning arc over time | US-6.1 steady progress across sessions · US-6.2 reach unvocalized MSA (north star) · US-6.3 breathes down gracefully |
| **E7** | Native typing — trainer keyboard | US-7.1 dual-labelled keyboard · US-7.4 harakāt on Shift + auto-vowel · US-7.5 blend-aware margin correction |
| **E8** | Cross-cutting / non-functional | US-8.1 verified-blend gate · US-8.2 audio matches vocalized form · US-8.3 SR/keyboard/bidi a11y · US-8.4 instant plain turns / progress on search |

### (B) Motion legend

A panel on `surface-soft`, `rounded.lg`, titled `Motion legend — transitions-dev patterns in play`
(`latin-title-md`). One row per pattern actually used across the 6 journeys; each row = the pattern's
catalog name + number (`latin-label`), a one-line "where it's used" (`latin-body-sm`, body), and the
reduced-motion fallback note. These are the only nine patterns the storyboards reference (every
arrow label below maps to one of these), so the legend is the arrow-label key.

| Pattern (transitions-dev #) | Where it's used in these journeys | Reduced-motion |
|---|---|---|
| **token-morph** *(custom §4, base `text-states-swap` 04)* | The hero move. Word graduates English→Arabic, or sheds ḥarakāt, *in place* (J3-S3/S4, J4-S3, J5-S5, J6 s1/s3/s4/s6). ~230ms blur-fade, changed token only. | opacity-only; blur dropped |
| **texts-reveal (18)** | Blended prose paints (line-stagger), source-rail chips, margin notes — and **all gentle margin corrections** (explicitly NOT shake). Spine reading register, quick. | rested static, no rise |
| **shimmer-text (15)** | Tool strip "searching… / reading report.pdf" running state, quiet teal sweep in `surface-soft` (J1-S2, J2-S3). | sweep dropped, label still shows |
| **success-check (10)** | Tool strip ✓ draw; "I know this" confirm; rung unlock; nudge "Advance"; the reorder-arrow stroke-draw is built on this (J1-S3, J3-S7, J4-S4, J5-S8, J6 s2). | check appears static |
| **tabs-sliding (16)** | Segmented controls: AUTO·HOLD, Vowel Full·Min·Off, Mode A·B, hold-flavor sub-row (J3-S2/S4, J4-S2/S6). Moving pill. | pill jumps, no slide |
| **menu-dropdown (05)** | Word-card opens from a token on click; interlinear tray grows under a tapped phrase (J1-S8, J4-S5 with `card-resize`). | instant open |
| **panel-reveal (07)** | Drawers/trays slide in: doc drawer, dial tray, progression panel, keyboard dock, "more →" margin breakdown, re-assertion nudge (J1-S9, J2-S6/S7, J3-S2/S6, J5-S2). Close = softer reverse. | fade in/out, no slide |
| **tooltip (17)** | Citation source card; Arabic-word quick-peek (transliteration · gloss · ▶ audio). ~140ms hover-intent, instant out, `:focus-visible`. Floating UI `safePolygon` bridge (J1-S6/S7, J2-S5, J4-S6, J6 s5). | fade only |
| **icon-swap (09)** | ▶ → equalizer on real audio playback lifecycle (J6 s5); confirm celebration accent (J6 s2). Bound to `onended`, never a guessed timer. | instant swap |

> Also referenced as catalog cousins inside the rows above (not standalone legend entries):
> **card-resize (01)** (path-map inset expand, interlinear height tween), **skeleton-reveal (14)**
> (doc-chip parsing placeholder), **number-pop-in (02)** (twin-dot stamp tick-up). Add these as three
> small footnote chips under the legend if space allows.

### (C) The 6 journey storyboards

Each journey is a **labelled horizontal row** on warm paper:

- A **journey header card** at the row's leading (left) edge: `J# · Title` (`latin-title-md`) + the
  one-line goal (`latin-body-sm`, body) + a coverage chip listing the union of story ids the row touches.
- Then the ordered **state cards** left→right (storyboard reads LTR like a Western comic strip, even
  though each card's *content* may be RTL).
- Between every adjacent pair, a **simple line/connector arrow** (1px `hairline`→`muted` stroke, small
  arrowhead) carrying a two-line text label: line 1 = the transition name (`latin-label`, ink) keyed to
  the legend; line 2 = the inbound state's story-id chips (`status-pill`, muted).
- Each state card is ~320–400px wide (compact), `surface-card` or warm-paper per its render spec,
  `rounded.lg`, `hairline` outline, with a title strip (`latin-title-md`) and a story-id chip row.
- A **reuse** state shows a *thumbnail/reference* to the existing `brainstorm-v2` screen (a downscaled
  frame ref or a labelled placeholder `↳ reuses 01 Agent chat`) instead of a freshly built card.

---

## 2. Per-journey storyboards

Notation per state: **stateId · title** — render spec (condensed) — **inbound arrow:** transition —
**stories:** ids — **build:** NEW compact card *or* REUSE `<screen>`.

### J1 — Ask a question that triggers a web search  (9 states · 7 new)

*Goal:* Sam asks a current-events question, watches a calm visible web search, gets a verified blended
answer, verifies provenance via inline citations + source rail, and decodes the Arabic in place.

1. **J1-S1 · Composer — web-search armed** — docked `compose-bar` (`surface-card`, `rounded.lg`, RTL,
   minH 48px) holding the typed English question; left cluster = paperclip Attach · **web toggle ARMED**
   (`primary` teal fill, `on-primary`, label `بحث الويب · web` — the only teal moment) · trainer-keyboard
   glyph; right = Send pill (`button-primary`, `rounded.pill` 44px); `latin-caption` disclaimer above.
   **inbound:** — (start). **stories:** US-1.3, US-1.1. **build:** NEW.
2. **J1-S2 · Tool strip — RUNNING** — fresh assistant turn below a grey user bubble; first element is the
   collapsed tool-activity accordion (`surface-soft`, `rounded.sm`, `latin-label`, **LTR**) with a quiet
   teal shimmer + "searching the web…"; reading surface empty. **inbound:** **shimmer-text (15)**.
   **stories:** US-1.2, US-8.4. **build:** NEW.
3. **J1-S3 · Tool strip — DONE (4 sources)** — same strip resolved: ✓ + `بحثت في الويب · searched the
   web · 4 sources` (Eastern numeral `٤` LTR-in-RTL), faint expand chevron. **inbound:**
   **success-check (10) + text-states-swap (04)** (✓ draws, label cross-swaps in place). **stories:**
   US-1.2. **build:** NEW.
4. **J1-S4 · Blended answer streams in** — `bubble-assistant` (`surface-card`, `rounded.xl`, RTL,
   `arabic-reading-lg` 27px/1.95) painting a verified blend: `token-arabic-new` gold full-ḥarakāt +
   `token-arabic-learning` teal minimal + `english-recede` scaffolding; twin-dot stamp (gold V + teal S)
   in the RTL top-right. **inbound:** **texts-reveal (18)** line-stagger. **stories:** US-1.1, US-1.6.
   **build:** REUSE `01 Agent chat` (thumbnail).
5. **J1-S5 · Answer settled — citations + source rail** — same bubble + citation chrome: superscript
   gold numerals `¹ ²` (`accent-gold`, LTR-in-RTL, bidi-isolated, never mid-Arabic-word); source rail of
   numbered `badge-pill` chips (`surface-strong`) with "see all 4"; gold "grounded" margin note "This
   came from Reuters." **inbound:** **texts-reveal (18)** (chips stagger, note fades last — locked stream
   order). **stories:** US-1.4. **build:** REUSE `01 Agent chat` (thumbnail).
6. **J1-S6 · Hover a citation → source card** — `word-card-popover` (the only shadow tier:
   `surface-card`, `rounded.md`, `0 8px 24px rgba(26,22,18,0.12)`, 240px) anchored to `¹`: favicon +
   "Reuters" + "2d"; cited quote verbatim italic in source language (NOT blended); "open source ↗"
   teal. **inbound:** **tooltip (17)** (delayed fade+scale, instant out, hover-bridge). **stories:**
   US-1.4. **build:** NEW.
7. **J1-S7 · Hover an Arabic word → quick peek** — gold `token-arabic-new` (~48px tap zone) with a
   quick-peek tooltip: transliteration (JetBrains Mono) · one-line gloss · ▶ audio (on-demand, GREEN-only).
   Lightest disclosure rung, desktop/keyboard. **inbound:** **tooltip (17)** (~140ms hover-intent).
   **stories:** US-1.5. **build:** NEW.
8. **J1-S8 · Click the word → full word-card** — `word-card-popover` on click: headword (Amiri, full
   vocalized) · translit · gloss · **ROOT + PATTERN** breakdown + word-family row; footer "I know this"
   (`button-primary`) + "add to list" + "more →". Click = soft negative; "I know this" = vocab advance.
   **inbound:** **menu-dropdown (05)** (touch skips peek). **stories:** US-1.5, US-3.1. **build:** NEW.
9. **J1-S9 · "more →" → breakdown in the margin** — `word-card-detail` expanded into the per-message
   margin tray (`surface-soft`/`surface-card`, `latin-body-sm`): full root+pattern morphology, POS/feats,
   root-family; popover dismissed. Heaviest rung, parked out of the reading surface. **inbound:**
   **panel-reveal (07)** (reveals from the side). **stories:** US-1.5. **build:** NEW.

### J2 — Upload a document and ask about it  (7 states · 6 new)

*Goal:* Sam attaches a PDF, asks a real question, gets a verified blended answer grounded in — and
traceable to — the exact passage, so a learner who can't read Arabic can still trust the provenance.

1. **J2-S1 · Composer with Attach — doc chip PARSING** — `compose-bar` (RTL); left cluster with paperclip
   just-tapped, teal web toggle OFF (`surface-strong`), keyboard glyph, Send pill; attachment row has one
   doc chip (`surface-strong`, `rounded.pill`): PDF glyph + "report.pdf" + "12 pp" + ×, in **PARSING**
   (teal shimmer sweep + "parsing…", dimmed, not-ready). **inbound:** **skeleton-reveal (14)** (chip
   mounts as placeholder shimmer). **stories:** US-2.1. **build:** NEW.
2. **J2-S2 · Doc chip READY + question sent** — chip flipped READY (full opacity, teal tick/solid border,
   no "parsing"); learner question rises as `bubble-learner` (`surface-strong`, `rounded.xl`, RTL,
   `arabic-reading-md`) in plain English query register (never blended); field cleared; chip persists as
   context. **inbound:** **text-states-swap (04)** on chip + **texts-reveal (18)** bubble rise. **stories:**
   US-2.1, US-2.3. **build:** NEW.
3. **J2-S3 · Tool strip — "reading report.pdf" RUNNING** — assistant turn with only the collapsed
   tool-activity strip (`surface-soft`, `rounded.sm`, `latin-label`, LTR): teal spinner/shimmer +
   "reading report.pdf"; reading surface empty (faint placeholder). **inbound:** **shimmer-text (15)**.
   **stories:** US-2.5. **build:** NEW.
4. **J2-S4 · Cited, blended reply with grounded margin note** — full screen: strip DONE (✓ "read
   report.pdf", collapsed) above `bubble-assistant` blend (gold/teal washed vowel-faded tokens +
   `english-recede`); gold superscript citation on a scaffolding token; twin-dot stamp; source rail
   `badge-pill` chips; gold "grounded" note "This came from report.pdf, p. 5." **inbound:**
   **texts-reveal (18)** (prose → rail → note, locked order). **stories:** US-2.1, US-2.2, US-2.4.
   **build:** REUSE `02 Doc upload` (thumbnail).
5. **J2-S5 · Tap a citation → source card (doc title + p.5)** — `word-card-popover` shadow tier anchored
   to active `¹`; DOC payload: header = doc title "report.pdf" + "p. 5" / chunk badge (no favicon); body =
   cited quote verbatim italic in source language; footer "open in document →" teal; stream dims behind.
   **inbound:** **tooltip (17)** (delayed fade+scale, instant out). **stories:** US-2.2, US-2.6. **build:**
   NEW.
6. **J2-S6 · "open in document" → doc DRAWER with highlighted passage** — right doc drawer as an
   **overlay** (not a third column) over the dimmed stream; header "report.pdf · p. 5" (LTR); page rendered
   as source text with the cited passage scrolled in and highlighted (`status-new-bg #f6ecd2` band /
   `accent-gold` edge); passage verbatim, NOT tokenized; close × at the leading edge. **inbound:**
   **panel-reveal (07)** (slides in from the right). **stories:** US-2.2, US-2.6. **build:** NEW.
7. **J2-S7 · Dismiss drawer → back to the clean stream** — drawer gone, scrim cleared, stream restored;
   gold highlight cleared; reply still shows blend + resting `¹` + source rail + twin-dot + "grounded"
   note (trust surface persists); composer with active "report.pdf" chip docked for a grounded follow-up.
   **inbound:** **panel-reveal (07) reverse** (softer reverse slide-out). **stories:** US-2.2, US-2.3.
   **build:** NEW.

### J3 — Advance my blend level (and the re-assertion nudge)  (7 states · 4 new)

*Goal:* Sam deliberately pushes how much Arabic renders — feeling the change before committing — and
trusts that AUTO never crosses a level he held without asking first.

1. **J3-S1 · Reply with the twin-dot stamp** — `bubble-assistant` (~360px): a short blend (two known
   plain-ink + one learning teal-wash + `english-recede` scaffolding); twin-dot stamp in RTL top-right
   (gold ~60% / teal ~40%, tooltip "vocab 3 · grammar 2"); no tray. Resting state inviting the tap.
   **inbound:** — (start). **stories:** US-1.1, US-3.6, US-5.1. **build:** NEW.
2. **J3-S2 · Open the twin-dial tray (AUTO)** — composer-adjacent tray (`surface-soft`, `rounded.lg`):
   two stacked sliders on a 6-notch track — top **Words** (gold fill, ا/a glyph, knob @3) / bottom
   **Grammar** (teal fill, reorder-arrows icon, knob @2), each with a faint vertical "auto" tick under the
   knob; AUTO·HOLD segmented toggle (AUTO teal); vowel Full·Min·Off ("Min" teal); ~120px path-map inset.
   **inbound:** **panel-reveal (07)** + segmented pill via **tabs-sliding (16)**. **stories:** US-3.1,
   US-3.2, US-3.3, US-5.1, US-5.3. **build:** REUSE `03 Two-axis progression` (thumbnail).
3. **J3-S3 · Drag Words +1 → live ghost preview behind Apply** — Words knob @3→4 (gold past the pinned
   auto tick @3); gold "custom" pill; AUTO·HOLD flips HOLD; GHOST PREVIEW of the next reply (~70% opacity)
   with one more word flipped to `token-arabic-new` gold full-ḥarakāt mid-morph; floating "Apply"
   (`button-primary`) + "Cancel"; caption "preview — nothing commits until Apply"; Grammar untouched
   (decoupling). **inbound:** **token-morph (custom §4)** cross-blur behind Apply. **stories:** US-3.1,
   US-3.5, US-5.6. **build:** NEW.
4. **J3-S4 · Apply → reply re-renders more Arabic, stamp updates** — ghost/Apply gone; bubble committed
   at full opacity with the extra gold new-word; twin-dot GOLD dot 3→4 (~80%), teal unchanged; "custom"
   pill remains, HOLD shown; hold sub-row appears with three flavor pills (This chat / Until I resume /
   Make this my pace) + "Resume auto" teal; `vocabSource` reads custom/hold. **inbound:** **texts-reveal
   (18)** + **number-pop-in (02)** (stamp tick) + **tabs-sliding (16)** (hold sub-row). **stories:**
   US-3.1, US-3.5, US-5.3, US-5.6. **build:** NEW.
5. **J3-S5 · 2-D path map — off-diagonal is legal** — path-map expanded (~280px): warm-paper canvas,
   hairline grid, x=vocab/y=structure, ghosted auto-diagonal, four corner labels (start / vocab trainer /
   grammar trainer / full Arabic); single warm-gold dot at (4,2) visibly off-diagonal and legal (not red);
   tapped-cell ghost preview; solid dot = high confidence (low would render fuzzy). **inbound:**
   **card-resize (01)** (inset tweens up; dot micro-tweens to (4,2)). **stories:** US-3.4, US-5.6.
   **build:** REUSE `03 Two-axis progression` (thumbnail).
6. **J3-S6 · Re-assertion nudge in the margin** — later session: `margin-note-encourage`
   (`status-learning-bg #dcebe8`, `primary-active` text, `rounded.sm`): "You've confirmed 12 words and
   nailed agreement 5× — ready to let more render in Arabic?" + [Advance] (`button-primary`) / [Not yet]
   (`button-secondary`); dismissible ×, chat stays usable (never blocks); stamp still at HELD level (gold
   @4). AUTO asking BEFORE crossing the held dial. **inbound:** **panel-reveal (07) / texts-reveal (18)**
   (gentle, NOT a shake). **stories:** US-3.6, US-5.4, US-5.5, US-6.1. **build:** REUSE `05 Learning path`
   (thumbnail).
7. **J3-S7 · Tap Advance → dial +1, next reply at new stage** — nudge collapses with a small teal
   success-check; Words dial advances one band (auto tick + knob realign, AUTO re-respected); twin-dot
   GOLD dot 4→5 on the new bubble; next reply renders more Arabic content words within the 95% coverage
   floor (governor "ok"); muted "why it moved" tag = "advanced-vocab"; capped slew (+1 band only).
   **inbound:** **success-check (10)** + **number-pop-in (02)** + **texts-reveal (18)**. **stories:**
   US-5.5, US-5.4, US-6.1, US-6.2. **build:** NEW.

### J4 — Structure-swap — learn grammar then vocab  (6 states · 4 new)

*Goal:* Sam learns Arabic sentence structure (VSO, adj-after-noun, iḍāfa, definiteness) using English
words he knows — decoupling grammar from vocabulary — and verifies the mapping on demand, trusting every
structure is correct.

1. **J4-S1 · Normal reply (English/English baseline)** — `bubble-assistant` on warm paper: mostly
   `english-recede` scaffolding + 1–2 Arabic content tokens in status washes (gold new / teal learning,
   Amiri `arabic-reading-lg`); twin-dot low (gold V low / teal S low, "vocab 2 · grammar 0"); inactive
   "Mode A · B" segmented hint (`surface-strong`); caption "plain chat — English words, English order".
   The diagonal start the structure axis departs from. **inbound:** — (start). **stories:** US-4.5.
   **build:** NEW.
2. **J4-S2 · Switch to Mode A — segmented control slides** — focus on the "Mode A | Mode B" segmented pill
   (vowel-slider geometry, `surface-strong` track) with the moving selection landed on Mode A (`primary`
   teal / `on-primary`, `latin-label`); faint "custom" pill on the Grammar dial (structure high / vocab
   low); caption "grammar trainer — renderMode: grammar-trainer"; bubble behind mid-transform (ghosted);
   show the pill **mid-travel** for legibility. **inbound:** **tabs-sliding (16)**. **stories:** US-4.5,
   US-4.1. **build:** NEW.
3. **J4-S3 · Mode A reply — role-banded sentence in Arabic order** — hero swap bubble (`direction:rtl`):
   one surface line in Arabic order using known English words, bidi-isolated — "read · the·teacher ·
   the·new · book · the·student"; VERB on teal wash + "V" label, ADJ on gold wash + "ADJ", iḍāfa pair
   spanned by an `accent-gold` hairline bracket, ال clitics with thin teal underline + "DEF" chip;
   leading ⟸ glyph "reads right-to-left — Arabic order"; twin-dot flips (teal S high / gold V low, "vocab
   1 · grammar 3" — decoupled); one-shot `margin-note-encourage` "Arabic puts the verb first — VSO."
   **inbound:** **texts-reveal (18)** + hero **token-morph (custom)** (words morph into role washes; note
   fades last). **stories:** US-4.1, US-4.2, US-4.5, US-4.6. **build:** REUSE `04 Structure-swap`
   (thumbnail).
4. **J4-S4 · Toggle "show natural order" — reorder arrows draw** — same Mode A bubble, "show natural
   order" armed (teal); thin `muted #8a8275` curved connector arrows map each swapped word to its natural
   English position; shown at rest as static guides after a one-time ~250ms draw; caption "← maps Arabic
   order back to English order"; reduced-motion annotation; role-band washes remain (arrows are additive,
   not re-layout). **inbound:** **reorder-arrow draw (custom §4, built on success-check 10 stroke-draw)**.
   **stories:** US-4.3. **build:** NEW.
5. **J4-S5 · Tap a constituent — interlinear stack expands** — a 2-line IGT grows under ONE tapped phrase
   ("book the·student"): line 1 surface form, line 2 word-aligned gloss "the student's book", role chip
   "iḍāfa" (`badge-pill`), "GEN" marker (case marked only where load-bearing); rest of bubble static;
   reorder arrows still visible; caption "tap any constituent → scoped interlinear gloss". **inbound:**
   **card-resize (01) / menu-dropdown (05)** (height tweens open). **stories:** US-4.3, US-4.6. **build:**
   NEW.
6. **J4-S6 · Switch to Mode B — Arabic words in English structure** — Mode pill slid to Mode B; bubble
   re-renders **LTR** (`direction:ltr`): Arabic content words in English order — "The [مُعَلِّم gold-new]
   read the [طَالِب teal-learning] book", each Arabic token bidi-isolated, Amiri `arabic-token` 25px,
   status-tinted + vowel-faded; leading ⟹ "reads left-to-right — English order"; "recognition only —
   compose disabled" badge; one token mid-hover with quick-peek stub; twin-dot inverts (gold V high / teal
   S low, "vocab 3 · grammar 1"). **inbound:** **tabs-sliding (16)** + **texts-reveal (18)** + peek via
   **tooltip (17)**. **stories:** US-4.4. **build:** REUSE `04 Structure-swap` (thumbnail).

### J5 — Write back in Arabic and get corrected  (8 states · 7 new)

*Goal:* Sam (cannot type/read Arabic) writes back via the trainer keyboard, types the bare consonant
skeleton with harakāt on Shift, and gets a gentle blend-aware margin correction that never marks his
English fallbacks wrong — produce real Arabic before learning vocalization, encouraged not scolded.

1. **J5-1 · Composer at rest · Keyboard toggle armed** — composer band (~360px) on canvas: one
   `compose-bar` (`surface-card`, `rounded.lg`, RTL, minH 48px), empty placeholder; left cluster of three
   pills (paperclip · web OFF `surface-strong` · **trainer-keyboard toggle ARMED** in `primary` teal —
   the scarce-teal moment); Send pill at leading edge; `latin-caption` disclaimer above; no keyboard yet.
   **inbound:** — (start). **stories:** US-7.1. **build:** NEW.
2. **J5-2 · Trainer keyboard docks up** — full anchor: standard Arabic-101 (QWERTY-keyed) docked above the
   composer; three rows of `trainer-key` (`surface-card`, `rounded.sm`, 46px) each DUAL-LABELLED — large
   Arabic glyph (`arabic-token` 25px, ink) + small QWERTY hint (`key-cap`, `muted-soft`); Shift hints
   "harakāt"; some hints already near-invisible (per-key fade scaffold); RTL composer below, caret
   blinking. **inbound:** **panel-reveal (07)** (slides up above composer). **stories:** US-7.1, US-7.2.
   **build:** REUSE `07 Trainer keyboard` (thumbnail).
3. **J5-3 · Key pressed — F → ب flashes active** — cropped to the middle row: the F/ب key PRESSED →
   `trainer-key-active` (`status-learning-bg #dcebe8`, `primary-active` text); a live indicator chip
   "F → ب" (`latin-label`, `surface-strong`) floats above; one already-mastered key (ا) shows its QWERTY
   hint almost fully faded to `surface-card` (per-key fade is independent, not global). **inbound:**
   **key-press flash (custom §4, ~120ms pulse)** + tint swap (reduced-motion: instant tint, no anim).
   **stories:** US-7.3, US-7.2. **build:** NEW.
4. **J5-4 · Bare skeleton builds in the compose field** — `compose-bar` (RTL, `arabic-reading-md` 22px):
   the word grows right-to-left as a single bidi-isolated run, letters taking contextual forms
   (isolated→initial→medial→final) — bare consonant skeleton كتب, no harakāt, plain ink; muted hint
   "auto-vowelled on send"; optional held-Shift micro-state "Shift = harakāt". **inbound:** none (per-letter
   contextual reshaping is logical-order caret insertion, calm token register, never a slide). **stories:**
   US-7.1, US-7.4, US-7.6. **build:** NEW.
5. **J5-5 · Auto-vowel resolves the skeleton (verified)** — `compose-bar` word morphs in place كتب →
   verified كَتَبَ — short-vowel marks fade IN above/below the unchanged skeleton (skeleton & long-vowel
   letters never touched); a GREEN-verified tick (`correction-add #4f7a52` dot) at the trailing edge; note
   the withhold-vs-show rule (if not GREEN it shows a `confidence-uncertain #c08a2e` flag, never as
   correct). The never-show-wrong-Arabic guarantee at compose time. **inbound:** hero **token-morph
   (custom §4, ~230ms blur-fade)** (reduced-motion keeps opacity, drops blur). **stories:** US-7.4, US-8.1,
   US-7.6. **build:** NEW.
6. **J5-6 · Send → learner bubble rises** — `bubble-learner` (`surface-strong`, `rounded.xl`, RTL,
   `arabic-reading-md`): a short mixed run — verified كَتَبَ + an English fallback below vocab level in
   `english-recede` grey, bidi-isolated; NO inline marks, NO red (corrections live only in the margin);
   keyboard retracted/quieter. **inbound:** **texts-reveal (18)** (small blurred rise). **stories:**
   US-7.1, US-7.5, US-8.3. **build:** NEW.
7. **J5-7 · Blend-aware margin correction appears** — under the learner bubble, a `margin-note-correction`
   (`surface-card`, `rounded.sm`, `latin-body-sm`): gentle strike→fix diff — removed in `correction-remove
   #b5654a` (struck), proposed Arabic in `correction-add #4f7a52` (warm, text-color only, never fire-red;
   proposed Arabic verified GREEN first); category chip ("agreement"/"iḍāfa", `badge-pill`); the English
   fallback UNTOUCHED, note "English fallback — not marked wrong"; if Arabic were correct, no correction
   shows. **inbound:** **texts-reveal (18)** gentle fade — **explicitly NOT error-state-shake**. **stories:**
   US-7.5, US-8.1, US-7.6. **build:** NEW.
8. **J5-8 · Correct production promotes the word** — a small success moment on the correctly-produced word:
   brief **success-check** (status wash settling) + `margin-note-encourage` (`status-learning-bg`,
   `primary-active` text): "Nice — your كَتَبَ counts as strong evidence; this word is advancing." The
   strongest mastery-promotion signal for that (lemma, sense); no nudge fires unless threshold met.
   Production rewarded, feeds two-axis placement (closes the loop with J3/J4). **inbound:** **success-check
   (10)** on the token + **texts-reveal (18)** for the note. **stories:** US-7.5, US-5.5. **build:** NEW.

### J6 — A word matures over time — the vowel/blend lifecycle  (8 states · 7 new)

*Goal:* Sam watches ONE word — "library" / مكتبة — graduate from English scaffolding → brand-new gold
Arabic → teal "learning" → bare-vowel "known" (approaching unvocalized MSA) — and trusts every form was
verified-correct and reversible. The product thesis on a single token.

1. **j6-s0-english · English scaffolding — "library"** — ~340px warm-paper card: one centered RTL
   reading-line fragment (`arabic-reading-lg` 27px); mostly bare-ink Arabic placeholders; the SUBJECT
   token is English "library" in `token-english-recede` grey (no wash); a faint dashed `hairline` ring
   marks the protagonist; twin-dot stamp (gold ~1/5, teal ~1/5, "vocab 1 · grammar 1"); caption "status:
   not yet rendered in Arabic". **inbound:** — (start). **stories:** US-1.1, US-6.1. **build:** NEW.
2. **j6-s1-new-gold · NEW — مَكْتَبَة (gold wash, full ḥarakāt)** — protagonist flipped: Arabic مَكْتَبَة
   (`arabic-token` 25px) on `token-arabic-new` gold wash `#f6ecd2`, ink, FULL ḥarakāt; gold marginalia dot
   in the leading margin; stamp gold dot ~2/5; GREEN verification tick (`#4f7a52`) beside it; caption
   "NEW · full vowels · first Arabic appearance". **inbound:** hero **TOKEN-MORPH (custom §4, ~230ms
   cross-fade-in-place blur)** — "library" morphs in place into gold مَكْتَبَة, same slot. **stories:**
   US-6.2, US-1.6, US-1.1. **build:** NEW.
3. **j6-s2-confirm · "I know this" — confirm fires the advance** — token clicked: compact
   `word-card-popover` (shadow tier, 240px) — translit "maktaba" · gloss "library" · ▶ audio · "I know
   this" (`button-primary` teal, mid-press) + "add to list"; a sage success-check stroke draws over "I
   know this"; caption "confirm → vocab-axis advance event (lemma=maktaba)". **inbound:** **success-check
   (10) + icon-swap (09)** (fires the advance, queues the blend to mature). **stories:** US-1.5, US-6.1.
   **build:** NEW.
4. **j6-s3-learning-teal · LEARNING — مَكْتَبة (teal wash, minimal ḥarakāt)** — back to the reading line:
   protagonist now مَكْتَبة on `token-arabic-learning` teal wash `#dcebe8`, ink, MINIMAL ḥarakāt (only
   load-bearing short vowels remain; skeleton + long-vowel letters intact — only marks came off); leading
   marginalia dot now teal; stamp gold ~3/5; caption "LEARNING · minimal vowels · faded by subtraction
   from ONE verified form"; subtle ghost of the prior full-vowel form fades out. **inbound:** hero
   **TOKEN-MORPH (~230ms cross-fade-in-place)** (vowels fade off, wash gold→teal; reduced-motion:
   opacity-only). **stories:** US-6.2, US-6.1. **build:** NEW.
5. **j6-s4-known-bare · KNOWN — مكتبة (no wash, bare vowels)** — protagonist now مكتبة in plain ink
   (`status-known`), NO wash, NO marginalia dot (mastery is the absence of marking), BARE vowels yet full
   skeleton + long-vowel letters intact → reads like unvocalized MSA (the north star); neighbours mostly
   bare too; stamp gold ~4/5; caption "KNOWN · bare vowels · reads as unvocalized MSA — full form 1 tap
   away". **inbound:** hero **TOKEN-MORPH (~230ms)** (teal wash dissolves, last short vowels fade off;
   case/mood ending drops first/pausal as the shared "last wall"). **stories:** US-6.2, US-6.1. **build:**
   REUSE `06 Endpoint` (thumbnail).
6. **j6-s5-audio · Audio — bare word still speaks its full vocalized form** — the KNOWN bare token مكتبة
   hovered: quick-peek tooltip (`surface-card`) — translit "maktaba" + gloss "library" + audio control
   flipped ▶ → animated 3-bar EQUALIZER (teal); caption ties heard audio to the FULL vocalized form
   (مَكْتَبَة) though on-screen is bare; GREEN tick (audio only for GREEN-verified); line behind static.
   **inbound:** **icon-swap (09)** ▶→equalizer bound to real playback lifecycle (`onended`, never a timer);
   quick-peek fades via **tooltip (17)** (~140ms). **stories:** US-1.5, US-6.2. **build:** NEW.
7. **j6-s6-breathe-down · Breathe-down — a click re-adds the vowels (non-punitive)** — Sam clicks bare
   مكتبة as a soft "I didn't know this": token breathes back toward learning — teal wash `#dcebe8` returns,
   minimal ḥarakāt re-appear on the same skeleton (مَكْتَبة again); gentle `margin-note-encourage`
   (`status-learning-bg`, `primary-active`, `rounded.sm`) "Let's re-warm this one — its vowels are back.";
   NO red / no error glyph / no shake; twin-dot gold ticks DOWN one (vocab axis non-monotonic); caption
   "movedReason: breathed-down · word-click = soft negative signal". **inbound:** **TOKEN-MORPH back
   (reversed ~230ms)** + margin note via **texts-reveal (18)** — explicitly NOT shake. **stories:** US-6.3,
   US-1.5. **build:** NEW.
8. **j6-s7-guarantee · The trust footer — every form was verified** — a slim full-width footer band
   (`surface-soft #f3efe6`, `rounded.sm`) as a tiny filmstrip: four thumbnails of the same word —
   library(grey) → مَكْتَبَة(gold/full) → مَكْتَبة(teal/min) → مكتبة(bare) — connected by three small morph
   arrows; one line of `latin-body-sm` body "Every form is produced by subtraction from ONE verified Arabic
   word — you never saw an incorrect vowel."; a single GREEN verified-blade glyph (`#4f7a52`); honors
   scarce-teal + no-third-color. **inbound:** **texts-reveal (18)** line-stagger (thumbnails + guarantee
   line rise in sequence). **stories:** US-1.6, US-2.4, US-6.2. **build:** NEW.

---

## 3. New compact mocks to build — master checklist (35)

Every state with `reuseExistingScreen == ""`. Build each at ~320–400px wide on warm paper, reusing
`DESIGN.md` components + the existing Figma variables/text styles. Reuse states (10) are NOT in this list
— they are thumbnail/reference pulls of the existing `brainstorm-v2` 01–07 screens.

**J1 — web search (7):**
- [ ] J1-S1 · Composer — web-search armed
- [ ] J1-S2 · Tool strip — RUNNING (searching…)
- [ ] J1-S3 · Tool strip — DONE (searched · 4 sources)
- [ ] J1-S6 · Hover a citation → source card
- [ ] J1-S7 · Hover an Arabic word → quick peek
- [ ] J1-S8 · Click the word → full word-card
- [ ] J1-S9 · "more →" → breakdown in the margin

**J2 — doc upload (6):**
- [ ] J2-S1 · Composer with Attach — doc chip PARSING
- [ ] J2-S2 · Doc chip READY + question sent
- [ ] J2-S3 · Tool strip — "reading report.pdf" RUNNING
- [ ] J2-S5 · Tap a citation → source card (doc title + p.5)
- [ ] J2-S6 · "open in document" → doc DRAWER with highlighted passage
- [ ] J2-S7 · Dismiss drawer → back to the clean stream

**J3 — advance blend + nudge (4):**
- [ ] J3-S1 · Reply with the twin-dot stamp
- [ ] J3-S3 · Drag Words +1 → live ghost preview behind Apply
- [ ] J3-S4 · Apply → reply re-renders more Arabic, stamp updates
- [ ] J3-S7 · Tap Advance → dial +1, next reply at new stage

**J4 — structure-swap (4):**
- [ ] J4-S1 · Normal reply (English/English baseline)
- [ ] J4-S2 · Switch to Mode A — segmented control slides
- [ ] J4-S4 · Toggle "show natural order" — reorder arrows draw
- [ ] J4-S5 · Tap a constituent — interlinear stack expands

**J5 — write back + correction (7):**
- [ ] J5-1 · Composer at rest · Keyboard toggle armed
- [ ] J5-3 · Key pressed — F → ب flashes active
- [ ] J5-4 · Bare skeleton builds in the compose field
- [ ] J5-5 · Auto-vowel resolves the skeleton (verified)
- [ ] J5-6 · Send → learner bubble rises
- [ ] J5-7 · Blend-aware margin correction appears
- [ ] J5-8 · Correct production promotes the word

**J6 — word lifecycle (7):**
- [ ] j6-s0-english · English scaffolding — "library"
- [ ] j6-s1-new-gold · NEW — مَكْتَبَة (gold wash, full ḥarakāt)
- [ ] j6-s2-confirm · "I know this" — confirm fires the advance
- [ ] j6-s3-learning-teal · LEARNING — مَكْتَبة (teal wash, minimal ḥarakāt)
- [ ] j6-s5-audio · Audio — bare word still speaks its full vocalized form
- [ ] j6-s6-breathe-down · Breathe-down — a click re-adds the vowels
- [ ] j6-s7-guarantee · The trust footer — every form was verified

**Reuse-as-thumbnail references (10, not built):** J1-S4 + J1-S5 → `01 Agent chat`; J2-S4 → `02 Doc
upload`; J3-S2 + J3-S5 → `03 Two-axis progression`; J3-S6 → `05 Learning path`; J4-S3 + J4-S6 → `04
Structure-swap`; J5-2 → `07 Trainer keyboard`; j6-s4-known-bare → `06 Endpoint`.

---

## 4. Build notes

**Tokens & styles — reuse, never re-create.**
- Bind every fill/text/radius to the **existing Figma variables + text styles** generated from `DESIGN.md`
  — do not hardcode hexes. Canonical references: `canvas #fbf9f4`, `surface-soft #f3efe6`, `surface-card
  #ffffff`, `surface-strong #ece6d9`, `hairline #e4ddcd`; `primary #0f766e` / `primary-active #0b5a54`;
  `accent-gold #b8860b`; `ink #1a1612`, `body #574f45`, `english-recede #a79e8e`, `muted #8a8275`,
  `muted-soft #b4ac9d`; status `status-new-bg #f6ecd2` / `status-learning-bg #dcebe8` / `status-known
  #1a1612`; corrections `correction-add #4f7a52` / `correction-remove #b5654a` / `confidence-uncertain
  #c08a2e`.
- Type styles: Arabic in **Amiri** (`arabic-reading-lg` 27px/1.95 for spine prose, `arabic-token` 25px for
  clickable tokens, `arabic-reading-md` 22px for learner bubbles/compose); Latin chrome in **Inter**
  (`latin-title-md`, `latin-body-sm`, `latin-label`, `latin-caption`); transliteration + key-caps in
  **JetBrains Mono**. Never mix Amiri and Inter inside one token.
- Reuse the existing components verbatim: `bubble-assistant`, `bubble-learner`, `compose-bar`, `token-*`,
  `word-card-popover` (the only shadow tier — `0 8px 24px rgba(26,22,18,0.12)`), `margin-note-*`,
  `vowel-slider` / `vowel-slider-selected`, `trainer-key` / `trainer-key-active`, `badge-pill`,
  `status-pill`, `button-primary` / `button-secondary` / `button-text`.

**Compact-card geometry.**
- State cards ~320–400px wide, `surface-card` (or warm paper where the spec says so), `rounded.lg`,
  1px `hairline` outline; title strip in `latin-title-md`; a story-id chip row (`status-pill`, muted).
- Keep every card on **warm paper** — never stark white as a background; `surface-card #ffffff` is for the
  elevated bubble/card *inside* the state, not the page floor.
- Crop to the salient region — these are not full screens. Where a state needs more than a crop, REUSE the
  matching 01–07 anchor as a thumbnail instead of rebuilding the full screen.

**Arrows & labels.**
- Arrows are **simple lines/connectors** (1px `hairline`→`muted` stroke, small arrowhead), one per adjacent
  pair, left→right. Each carries a two-line text label: line 1 = the transition name keyed to the Motion
  Legend (§1B), line 2 = the inbound state's story-id chips. Start states ("—") get no inbound arrow.
- Do not over-style arrows; they are documentation connectors, not animated prototype links. (If anyone
  later wants a clickable prototype, the transition names map 1:1 onto `transitions apply <name>` targets
  per `80-v2-motion-spec.md §3`.)

**RTL / bidi correctness inside cards.**
- The storyboard rows read **LTR** (Western comic-strip order); a card's *content* may be RTL. Set
  `direction:rtl` on any bubble/compose surface; bidi-isolate every embedded Latin run (filenames, URLs,
  citation numerals, English scaffolding tokens) with U+2066–2069 / `<bdi>`; render Eastern Arabic-Indic
  numerals LTR-in-RTL. Mode A bubbles are RTL with a ⟸ glyph; Mode B bubbles are LTR with a ⟹ glyph.

**Motion-spec fidelity (the arrow labels are load-bearing).**
- The hero is **token-morph** (custom §4) — one calm ~230ms blur-fade reused for all three fading scaffolds
  (English / vowels / keyboard labels); it appears as the inbound label on J3-S3/S4, J4-S3, J5-S5, and the
  whole J6 lifecycle. Tune it once; everything else is off-the-shelf catalog.
- Honor the **anti-patterns**: NO `error-state-shake` on learner output (corrections are gentle margin
  reveals — J5-S7, j6-s6); don't animate the Arabic reading line beyond the quick token morph; keep tool
  chrome (shimmer/accordion) in the quiet `surface-soft` register; keep every reduced-motion guard
  (annotate it on each motion-bearing card, e.g. J4-S4 arrow-draw, J5-S3 key flash, J5-S5 vowel morph).
- Locked stream order on every assistant turn: **tokens → tool/citation chrome → margin** (J1-S4/S5,
  J2-S4) — reflect it in the arrow sequencing.

**Scarce-teal discipline.** One or two teal moments per surface, max. On these cards teal is reserved for:
the armed web/keyboard toggle, primary CTAs (Send, Apply, Advance, "I know this"), the learning-state wash,
the segmented-control selected pill, and the Structure dial — nothing else. Gold is illustrative
(new-word wash, marginalia, citation numerals); no third brand color.
