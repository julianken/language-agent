# v2 Motion Spec — language-agent × transitions-dev

> Maps every v2 interaction to a transitions-dev pattern (the 18-transition library installed at
> `~/.claude/skills/transitions-dev/`). `DESIGN.md` marked motion out-of-scope for v1; this defines it
> for v2. Screen refs are the `brainstorm-v2` Figma frames (01–07). Once we have app code, each row is a
> `transitions apply <name>` target. Every transitions-dev snippet ships a `prefers-reduced-motion` guard —
> keep them all.

## 1. Motion principles (product-specific — these gate every choice)

1. **Calm over flashy.** The product is warm-paper, editorial, reading-first. Motion is *short and quiet*
   (120–320ms), never bouncy on the reading surface. The brand's "one distinctive move" is typographic, not
   kinetic — so motion *serves* legibility, it doesn't perform.
2. **The signature motion is the FADE.** The whole product is "training wheels coming off": English recedes,
   vowels fade, keyboard labels fade. The hero transition is therefore a gentle **cross-fade/blur-morph on a
   token** (built on `text-states-swap`), not a slide or a pop. When a word graduates English→Arabic or
   sheds its vowels, it should *morph in place*, calmly.
3. **Non-punitive — NO shake.** `error-state-shake` (12) is the natural reflex for "wrong input," but it
   **contradicts the core pedagogy** (corrections are gentle, margin-only, blend-aware — "English fallback is
   never marked wrong"). Corrections animate as a quiet margin **reveal**, never a shake. Reserve shake *only*
   for a true system failure (e.g. a failed upload), if ever.
4. **Tool chrome is quiet.** Search/doc motion lives in the `surface-soft` register — a shimmer while
   thinking, a soft accordion expand — never competing with the Arabic prose.
5. **Reduced-motion is non-negotiable.** Keep every snippet's guard; on `reduce`, fades/opacity stay,
   transforms/blur drop.

## 2. The flow (key journeys + the transitions *between* states)

- **Cold-start onboarding (4-tap calibration)** → `page-side-by-side` (08) between steps + `texts-reveal`
  (18) for each step's headline+supporting copy. The "recognize these 6 words?" seeding uses `success-check`
  (10) per correct tap.
- **Send a message → answer assembles** (the spine, screen 01). Ordered, streamed:
  1. user bubble rises (small `texts-reveal`),
  2. tool strip appears in **`shimmer-text`** (15) "searching…",
  3. it resolves: `success-check` (10) on the ✓ + `text-states-swap` (04) "searching…"→"searched · 4 sources",
  4. blended prose paints via `texts-reveal` (18) line-stagger (token stream underneath),
  5. source rail chips stagger in (`texts-reveal`),
  6. margin tray notes fade in last.
  This *is* v1's locked stream order (tokens → corrections/margin → tool parts), expressed as motion.
- **Open progression panel** (screen 03) → `panel-reveal` (07) from the composer.
- **Open doc drawer** (screen 02) → `panel-reveal` (07) from the right; close = softer reverse.
- **Dock the trainer keyboard** (screen 07) → `panel-reveal` (07) sliding up above the composer.

## 3. Per-surface animation catalog

| # | Surface / interaction (screen) | transitions-dev pattern | Trigger | Note |
|---|---|---|---|---|
| 1 | Tool-activity "searching…" (01,02) | **shimmer-text** (15) | tool call running | pure CSS; the "alive/thinking" state |
| 2 | Tool strip resolves to "✓ … 4 sources" (01) | **success-check** (10) + **text-states-swap** (04) | tool done | check draws; label swaps in place |
| 3 | Tool accordion expand/collapse (01) | **card-resize** (01) | tap the strip | height tween; quiet |
| 4 | Search-result cards loading (01) | **skeleton-reveal** (14) | results pending → ready | placeholder → cross-blur to real |
| 5 | Citation hover/tap card (01,02) | **tooltip** (17) | hover/tap a `¹` marker | delayed fade+scale in, instant out |
| 6 | Doc drawer open/close (02) | **panel-reveal** (07) | "open in document" | overlay, not a column |
| 7 | Assistant prose entering (01,06) | **texts-reveal** (18) | reply streams | blurred rise, *quick* (reading surface) |
| 8 | Composer pill row hover (01,07) | **avatar-group-hover** (11) | hover Attach/Web/Keyboard | distance-falloff lift on the chip stack |
| 9 | Vowel Full·Min·Off / AUTO·HOLD / Mode A·B (03,05,04) | **tabs-sliding** (16) | tap a segment | moving pill — our segmented controls |
| 10 | Clear the composer field | **input-clear-dissolve** (13) | × / reset | fly-out + per-word streak |
| 11 | Trainer keyboard docks (07) | **panel-reveal** (07) | Keyboard toggle on | slides up above composer |
| 12 | "742 words" / coverage counter (05) | **number-pop-in** (02) | placement recompute | per-digit blurred slide |
| 13 | Confirm a word / "I know this" (01) | **success-check** (10) (+ **icon-swap** 09) | word-card confirm | small celebration; advances the blend |
| 14 | Grammar rung unlock — iḍāfa→VSO (05) | **success-check** (10) | rung mastered | unlock moment + rung fill |
| 15 | Re-assertion nudge card (05) | **panel-reveal** (07) / **texts-reveal** (18) | placement crosses a held dial | dismissible; "Advance" → success-check |
| 16 | Due-review badge on word-list | **notification-badge** (03) | items become due | dot pop on the trigger |
| 17 | Interlinear constituent expand (04) | **card-resize** (01) / **menu-dropdown** (05) | tap a constituent | height grows under that phrase |
| 18 | **Correction appears in margin** (01) | **texts-reveal** (18) — *gentle fade* | corrector returns an edit | **explicitly NOT error-shake** (principle 3) |

### Word lookup — two-tier disclosure (decided 2026-06-21)

**Hover / keyboard-focus → quick-peek `tooltip` (17):** transliteration · one-line gloss · a ▶ audio
button (on-demand, **never auto-play**). ~140ms hover-intent delay so it doesn't flicker as the eye
sweeps a line of clickable words; instant out; `:focus-visible`-accessible. **Click / tap → the full
word-card** (the v1 hybrid: popover + "more →" margin breakdown — root/pattern, family, add-to-list).
**Touch has no hover** → a tap goes straight to the card; the peek is desktop/keyboard only. This is the
lightest rung of the existing peek → card → margin disclosure. Prototyped live in a local motion prototype (not committed).

## 4. Customs to build (not in the 18 — but lean on a catalog cousin)

These are the *signature* product motions; build them small, tuned to the catalog's tokens/easing:

- **Token blend/vowel morph** — a word changing English→Arabic, or shedding its ḥarakāt, *in place*. Base on
  **`text-states-swap` (04)** (blurred up-and-down), retuned to a *cross-fade-in-place* so it reads as the
  same word maturing, not two different words. **This is the hero transition** — it makes "training wheels
  coming off" visible. Keep it quick and only on the changed token, never the whole line.
- **Key-press flash + per-key label fade** (07) — keypress = a ~120ms scale/opacity pulse on the key
  (custom; no catalog match). Label fade = a slow opacity transition on the English label keyed to per-key
  typing mastery (the third scaffold). Both reduced-motion-safe (label fade is opacity, survives `reduce`).
- **Structure-swap reorder-arrow draw** (04) — the "show natural order" connectors draw once (~250ms) then
  rest static. Base on **`success-check`'s stroke-draw** (10) (`stroke-dasharray`/`getTotalLength`), respect
  `prefers-reduced-motion` (skip the draw, show static guides).
- **Dial / map micro-tweens** (03) — slider knob, the 2-D path-map dot, and the coverage bar are simple
  `transform`/`width` transitions on the DESIGN.md easing; the dial-drag **ghost preview** of the next reply
  is a `panel-reveal`-style cross-blur behind an "Apply" confirm.

## 5. Anti-patterns (locked)

- **No `error-state-shake` (12) on learner output.** It teaches "you failed." Corrections are gentle margin
  reveals. (Principle 3.)
- **Don't animate the Arabic reading line itself** beyond the quick token morph — never slide/bounce running
  prose; it breaks reading.
- **Don't let tool chrome out-animate the prose** — shimmer/accordion stay in the quiet register.
- **Don't strip the reduced-motion guards** or collapse the enumerated `transition:` props to `transition: all`
  (transitions-dev's common-mistakes list).

## 6. Motion tokens → DESIGN.md §Motion (currently a stub)

Propose a small token set, aligned with transitions-dev's semantic vars, to fill the empty `## Motion`
section of `DESIGN.md`:

```
motion:
  fast:    120ms   # key-press flash, hover lift, tooltip
  base:    200ms   # token morph, tab pill, text swap, panel reveal
  slow:    320ms   # drawer, modal-ish, success check
  fade-label: 600ms   # the per-key / vowel / English scaffold fades (slow on purpose)
  ease-standard:   cubic-bezier(0.2, 0, 0, 1)      # most transitions
  ease-emphasized: cubic-bezier(0.3, 0, 0, 1)      # reveals/drawers
  ease-spring:     cubic-bezier(0.2, 0.9, 0.3, 1.2) # the rare bounce (badge dot, avatar return)
```

These map onto transitions-dev's `--resize-*`, `--dropdown-*`, `--tabs-*`, `--stagger-*`, `--tt-*`, etc.
when we `transitions apply` each row in §3 against real components.

## 7. Build order (when we have a frontend)

1. The **token morph** (custom, §4) + **tabs-sliding** segmented controls — they appear on every screen.
2. The **stream-assembly** sequence (§2) — shimmer → success-check → texts-reveal — it's the spine.
3. **panel-reveal** (keyboard dock, doc drawer, progression panel) — three uses, one pattern.
4. **success-check** moments (confirm word, rung unlock) + **number-pop-in** counters.
5. Polish: citation **tooltip**, **skeleton-reveal**, **notification-badge**, reorder-arrow draw.

## 8. Prototype findings → production rules

Surfaced while building the live motion prototype (local, not committed). Each is a real frontend rule, not demo-only:

1. **`[hidden]{display:none !important;}` in the CSS reset.** Any component with a class-level `display`
   (flex/grid/inline-block) silently defeats the `hidden` attribute (equal specificity, author wins) — the
   shimmer "searching…" never stopped until this was added. Bites once, everywhere.
2. **Interactive tooltips need a hover-bridge + `pointer-events:auto` when shown.** An 8px gap between word
   and tooltip drops `:hover` mid-travel; a display-only tooltip also can't host the ▶ button. In production
   use **Floating UI `safePolygon`** (named in the v1 frontend brief) — it does the gap-bridge, edge-collision,
   and RTL flip properly; the demo's `::before` bridge proves the interaction only.
3. **Audio = a barge-in contract bound to the real playback lifecycle.** *Idle → just play; busy → stop-then-play.*
   Never call `cancel()` unconditionally (it locks the engine for a beat). The **icon-swap (09)** play↔equalizer
   state is driven by the actual end event (`onend` here; the `<audio>` element's `ended` in production) — so a
   slow TTS blob keeps the equalizer running until it genuinely finishes, never a guessed timer.
4. **One transition helper, one job.** The `swapWord` bug (word vanished) came from overloading a class-replacing
   morph and a text-only swap in one function — always clear the enter/exit lifecycle unconditionally; treat the
   class change as optional decoration.
5. **Re-measure font-dependent layout on `document.fonts.ready`.** The tabs-sliding pill measured tab widths
   before Amiri/Inter loaded and sat misaligned until first click. Any JS that measures text must re-run after
   the webfont swap (and on `resize`).
6. **Never `innerHTML` model-/service-generated content.** The word-card breakdowns, glosses, and examples are
   LLM/dictionary output — our entire UI is model output. Build the DOM with `textContent`/`createElement` or
   sanitize (DOMPurify). Model output → DOM is the app's primary injection surface.
7. **The hero token-morph is one calm ~230ms blur-fade**, reused for all three scaffolds (English/vowels/keyboard
   labels). Build and tune it once; everything else is the off-the-shelf catalog. → lock the numbers into the
   `DESIGN.md` §Motion token set (§6 above).
