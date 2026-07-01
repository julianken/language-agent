# DESIGN.md — language-agent

> **This file is the whole truth for design.** An agent that has never opened this app must be able to rebuild any surface to pixel fidelity from this document alone — no design file, no component browser, no follow-up questions. Every value here is concrete and current. Where this file and the working build disagree, the build wins; reconcile this file to match it.
>
> **Authority:** shipped build > `DESIGN.md` > Figma (see `AGENTS.md` → "Design source of truth"). `DESIGN.md` wins on any design conflict. The product's Figma file (`mFjP4XMgcvdwzloZL9EMze`; the v3 pages — see `INSTANCE.md` → "Node map") is **visual reference only**: a live Figma value that disagrees with this file is drift to reconcile into `§0 Token Manifest` in a PR, not a source the build follows directly. Keep raw literals (hexes, sizes, durations) in `§0` only; reference them by name everywhere else, so there is one place to change a value.

`language-agent` reads like a quiet annotated edition — a warm-paper reading surface where Arabic is the subject and everything else is scaffolding that gets out of the way. The base canvas is **warm paper** (`canvas` — #fbf9f4), deliberately not stark white, because the product is a long-form *reading* tool first. The single brand voltage is a **scholarly deep teal** (`primary` — #0f766e), used scarcely: the persona, primary actions, and the "learning" word state. A **manuscript gold** (`accent-gold` — #b8860b) is the only secondary accent, reserved for the new-word marginalia tint.

The organizing idea is **progress-as-typography**: the reading surface *is* the progress display. Every Arabic word is tinted by familiarity and sheds its short-vowel marks (ḥarakāt) as it is mastered, so a learner literally watches the training wheels come off in the text. Three scaffolds recede on the same principle — **English fades**, **vowels fade**, and **keyboard labels fade** — and the visual language makes all three legible without ever shouting. Layout is **conversation-first**: a collapsible left tool rail, a central conversation spine and composer (the driver), and a right margin channel for context. Depth comes from soft warm elevation bands and a single card tier — never decorative shadow.

---

## 0. Token Manifest

The authoritative source of truth for every value. Reference these by name in the prose below; never repeat a raw literal outside this section.

> **Machine mirror:** [`tokens.json`](tokens.json) (repo root, W3C DTCG) is the machine-readable mirror of this section, structured in three tiers — **primitive** (the raw values below), **semantic** (role aliases — what frames/components bind to), and **locale** (per-language deltas → the Figma CORE library's `Locale` modes `ar`/`zh`). `DESIGN.md` §0 stays the *human* source of truth; `tokens.json` and the Figma CORE library are generated mirrors — reconcile all three in the same PR. Rationale + the one-system/N-instances inheritance architecture: [`docs/decisions/design-system-inheritance.md`](docs/decisions/design-system-inheritance.md).

### Color

| Token | Value | Role |
|---|---|---|
| `primary` | `#0f766e` | Brand teal — persona, primary CTAs, "learning" state, focus rings. Scarce. |
| `primary-active` | `#0b5a54` | Press-state darken. |
| `primary-disabled` | `#a9c6c2` | Disabled action tint. |
| `accent-gold` | `#b8860b` | Lone secondary accent — new-word tint, brand glyph. Illustrative, not an action color. |
| `ink` | `#1a1612` | Warm near-black — Arabic reading text, primary headings. |
| `body` | `#574f45` | Default Latin running text (warm grey). |
| `english-recede` | `#a79e8e` | Greyed English scaffolding tokens in the blend. |
| `muted` | `#8a8275` | Labels, captions, secondary chrome. |
| `muted-soft` | `#b4ac9d` | Fading trainer-key labels; disabled text. |
| `on-primary` | `#ffffff` | Text on teal. |
| `on-dark` | `#f7f3ea` | Warm off-white on the dark surface. |
| `on-dark-soft` | `#b4ac9d` | Secondary text on dark. |
| `canvas` | `#fbf9f4` | Default warm-paper reading floor. |
| `surface-soft` | `#f3efe6` | Tool-rail / margin-channel elevation band. |
| `surface-card` | `#ffffff` | Popover word-cards + message bubbles (one step brighter than canvas = elevated). |
| `surface-strong` | `#ece6d9` | Fill behind chips, secondary buttons, status pills. |
| `surface-dark` | `#1a1612` | Rare warm near-black — focus-reading mode / onboarding hero. |
| `surface-dark-elevated` | `#262019` | Cards on the dark surface. |
| `hairline` | `#e4ddcd` | Default 1px divider on paper. |
| `hairline-soft` | `#efe9dc` | Lighter divider. |
| `status-new` / `status-new-bg` | `#b8860b` / `#f6ecd2` | New word — gold wash. Carries **full** ḥarakāt. |
| `status-learning` / `status-learning-bg` | `#0f766e` / `#dcebe8` | In acquisition — teal wash. Carries **minimal** ḥarakāt. |
| `status-known` | `#1a1612` | Mastered — no tint, plain ink, **bare** of ḥarakāt. |
| `correction-add` | `#4f7a52` | Proposed fix — soft sage, text color only. |
| `correction-remove` | `#b5654a` | Struck text — muted terracotta, never fire-red. |
| `confidence-uncertain` | `#c08a2e` | Verifier "uncertain" flag on a word. |

### Typography

Families: **Amiri** (Arabic display + reading; fallbacks Scheherazade New, Noto Naskh Arabic — chosen because designed for ḥarakāt), **Inter** (all Latin UI), **JetBrains Mono** (transliteration + trainer key-caps). All open-licensed; no substitution gap. Never mix Amiri and Inter inside one word — the blend switches at whole-token boundaries.

| Token | Size | Weight | Line-height | Use |
|---|---|---|---|---|
| `arabic-display` | 40px | 400 | 1.5 | Persona name, lesson titles |
| `arabic-reading-lg` | 27px | 400 | 1.95 | The conversation spine — the star |
| `arabic-reading-md` | 22px | 400 | 1.85 | Learner bubbles, word-list rows, compose bar |
| `arabic-token` | 25px | 400 | 1.9 | Individual clickable token (sized for ḥarakāt + tap) |
| `latin-title-lg` | 24px | 600 | 1.25 | UI section heads |
| `latin-title-md` | 18px | 600 | 1.33 | Card / panel titles |
| `latin-body` | 16px | 400 | 1.55 | Default Latin body |
| `latin-body-sm` | 14px | 400 | 1.5 | Margin notes, word-card body |
| `latin-label` | 12px | 600 | 1.4 (+0.4px tracking) | Uppercase rail / pill labels |
| `latin-caption` | 13px | 400 | 1.5 | Captions |
| `transliteration` | 13px | 500 | 1.4 | Romanized pronunciation (mono) |
| `key-cap` | 15px | 600 | 1.0 | Trainer-keyboard QWERTY labels (mono) |
| `button` | 15px | 600 | 1.15 | CTA pills |
| `nav-link` | 14px | 500 | 1.4 | Tool-rail / nav items |

### Spacing (base unit 4px)

`xxs` 4 · `xs` 8 · `sm` 12 · `base` 16 · `md` 20 · `lg` 24 · `xl` 32 · `xxl` 48 · `section` 80.

### Radii

`none` 0 · `xs` 4 (token chips, key-caps) · `sm` 8 (margin notes, vowel slider) · `md` 12 (inputs, popover) · `lg` 16 (panels, compose bar, persona header) · `xl` 22 (message bubbles) · `pill` 100 (buttons, status pills) · `full` 9999 (avatars).

### Motion

| Token | Value | Use |
|---|---|---|
| `duration/fast` | 120ms | Key-press flash, hover lift, tooltip |
| `duration/base` | 200ms | Token morph, tab pill, text swap, panel reveal |
| `duration/slow` | 320ms | Drawer, modal, success-check |
| `duration/fade-label` | 600ms | The per-key / vowel / English scaffold fades (slow on purpose) |
| `duration/token-morph` | 230ms | The hero blur-fade — a word maturing in place |
| `ease/standard` | `cubic-bezier(0.2, 0, 0, 1)` | Most transitions |
| `ease/emphasized` | `cubic-bezier(0.3, 0, 0, 1)` | Reveals / drawers |
| `ease/spring` | `cubic-bezier(0.2, 0.9, 0.3, 1.2)` | The rare bounce (badge dot, avatar return) |

### Elevation

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow, no border | Canvas + most surfaces |
| Warm band | Fill shift to `surface-soft` | Tool rail, margin channel |
| Hairline | 1px `hairline` | Bubble + card outlines on paper |
| Soft card | `0 8px 24px rgba(26,22,18,0.12)` | The single shadow tier — only the click-word popover |

Depth is layout, not shadow. The click-word popover is the **only** element that floats.

---

## Color & contrast

- **Brand teal** (`primary`) carries the persona, primary CTA pills, the "learning" word tint, and focus rings — kept scarce (one or two teal moments per surface). `primary-active` is the press darken; `primary-disabled` the faded tint.
- **Manuscript gold** (`accent-gold`) is the lone secondary accent: the new-word tint and brand glyph. Illustrative, never an action color. **No third brand color** — status tints are semantic, not brand.
- **Surfaces** are warm-paper tiers: `canvas` (reading floor) → `surface-soft` (banded rails) → `surface-card` (#fff, *elevated only* — bubbles, popovers) → `surface-strong` (chips, secondary buttons). Stark pure-white is reserved for elevated cards; never the reading canvas.
- **Word-status semantics** are the core domain "data-viz," rendered in running text. Tint **whispers** — a soft background wash + ink text, never colored text on white: `status-new` gold wash (full ḥarakāt) → `status-learning` teal wash (minimal ḥarakāt) → `status-known` no tint, plain `ink`, bare. **Mastery is the absence of marking.**
- **Correction semantics** are gentle and margin-only: `correction-add` sage, `correction-remove` terracotta — warm, never fire-red, text color only. `confidence-uncertain` flags a word the verifier wasn't sure of.
- **Contrast target: WCAG AA** (4.5:1 body, 3:1 large/UI). `ink`/`body` on `canvas`/`surface-*` clear AA; `on-primary` on `primary` clears AA. Status washes sit behind `ink` text (not colored text) precisely so contrast never depends on the tint.

## Typography

- **Arabic is the largest type in the system and gets the most line-height (≥1.85).** Short vowels live above and below the baseline; cramped leading collides them. This is the single most important typographic rule — a vowel-teaching tool that renders ḥarakāt too small has failed at its one job. The conversation spine is `arabic-reading-lg` (27px / 1.95).
- **English recedes** — blend English is set in `english-recede` grey so attention lands on the Arabic being acquired.
- **Mono only for romanization and key-caps** (`transliteration`, `key-cap`).
- **Never mix Amiri and Inter inside one word** — the blend switches at whole-token boundaries (the free-morpheme rule); a token is wholly Arabic or wholly Latin.
- Arabic is sized ~10–15% larger than its Latin counterpart at every level.

## Motion

Motion was deferred in v1 and specified in v2; the binding token set lives in `§0` above. The full per-surface interaction→transition catalog (mapped onto the 18-pattern `transitions-dev` library, plus the custom signature motions) lives in [`docs/plans/motion-spec.md`](docs/plans/motion-spec.md) — this section is the binding rules it must satisfy.

**Principles (these gate every motion choice):**
1. **Calm over flashy.** Warm-paper, editorial, reading-first. Motion is short and quiet (`duration/fast`–`duration/slow`, 120–320ms), never bouncy on the reading surface.
2. **The signature motion is the FADE.** The whole product is "training wheels coming off": English recedes, vowels fade, keyboard labels fade. The hero transition is a gentle **cross-fade/blur-morph on a token** (`duration/token-morph`, ~230ms) — when a word graduates English→Arabic or sheds its vowels it *morphs in place*, calmly, only on the changed token, never the whole line. One helper, tuned once, reused for all three scaffolds.
3. **Non-punitive — NO shake.** A learner-output error is **never** a shake (that teaches "you failed"). Corrections animate as a quiet margin **reveal**. Reserve shake only for a true system failure (e.g. a failed upload), if ever.
4. **Tool chrome is quiet.** Search/doc motion lives in the `surface-soft` register — a shimmer while thinking, a soft accordion expand — never competing with the Arabic prose.
5. **Reduced-motion is non-negotiable.** Every transition ships a `prefers-reduced-motion: reduce` guard; on `reduce`, fades/opacity stay, transforms/blur drop. Never collapse enumerated `transition:` props to `transition: all`.

## Components

### App shell & columns
**`app-shell`** — the conversation-first layout on `canvas`. **`tool-rail`** (left ~220px, `surface-soft`, collapsible): word list, persona, vowel slider, keyboard toggle, nav. **`conversation-spine`** (center, RTL, `arabic-reading-lg`, caps ~640px measure) + its bottom composer: the driver — what the learner reads and replies in. **`margin-channel`** (right ~300px, `surface-soft`): glosses, grammar, corrections, encouragement — lags the spine (English early → simple Arabic as the blend matures). The shell chrome reads LTR; the conversation *content* reads RTL.

### Conversation
**`bubble-assistant`** — persona turn: `surface-card`, `radius/xl`, RTL, `arabic-reading-lg`, blended English + Arabic tokens. **`bubble-learner`** — learner turn: `surface-strong`, same geometry, corrected in the margin (never inline).

### Tokens (the core render)
**`token-arabic-new`** — `status-new-bg` gold wash, full ḥarakāt. **`token-arabic-learning`** — `status-learning-bg` teal wash, minimal ḥarakāt. **`token-arabic-known`** — no tint, plain `ink`, bare. **`token-english-recede`** — `english-recede` grey, `latin-body`. Every token is bidi-isolated and individually clickable.

### Word card (click-a-word)
**`word-card-popover`** — compact floating card at the word: contextual meaning · audio · add-to-list. The only shadowed element (`0 8px 24px rgba(26,22,18,0.12)`). **`word-card-detail`** — the "more →" expansion into the margin: root + pattern breakdown, POS/features, root family. The root+pattern payload is the pedagogical core.

### Margin notes
**`margin-note-gloss`**, **`margin-note-grammar`**, **`margin-note-correction`** (carries a removed/added diff pair in `correction-remove`/`correction-add`), **`margin-note-encourage`** (`status-learning-bg` wash). All `latin-body-sm` on `surface-card`.

### Controls
**`vowel-slider`** — 3-segment Full · Minimal · Off, `surface-strong`, selected segment in `primary`. The manual override above the automatic per-word fade. **`trainer-key`** — a QWERTY key showing the Arabic glyph (`arabic-token`, `ink`) with a small fading English label (`key-cap`, `muted-soft` lerping toward invisible as per-key muscle memory builds); **`trainer-key-active`** press state `status-learning-bg`.

### Tools & forms
**`word-list-row`** (Arabic word + `status-pill`) · **`compose-bar`** (RTL input, `surface-card`, `radius/lg`) · **`persona-header`** · **`button-primary`** / **`button-secondary`** / **`button-text`** · **`text-input`** · **`badge-pill`** / **`status-pill`**.

## Accessibility

- **Contrast: WCAG AA** (4.5:1 text, 3:1 large/UI). Status is conveyed by **wash + ink**, never tint-only, so meaning never rides on color alone — the new/learning/known distinction is *also* encoded in ḥarakāt density (full / minimal / bare), a second non-color channel.
- **RTL / bidi is first-class correctness.** The spine is `direction: rtl`; **every token is wrapped in a Unicode bidi isolate** (U+2066–2069, preferred over embeddings). Operate on **logical characters, not visual glyphs** (Arabic has four contextual forms; glyph-indexing corrupts shaping). **Eastern Arabic-Indic numerals** (`٠١٢٣٤٥٦٧٨٩`) render LTR inside the RTL line.
- **Touch targets:** trainer keys 46px (above AAA), primary CTA pill 44px (AAA), clickable tokens (`arabic-token` 25px in a 1.9 line-height row) ≈ 48px effective tap zone.
- **Keyboard + focus:** every interactive element is keyboard-reachable; focus-visible uses a `primary` ring; the word-peek tooltip is `:focus-visible`-accessible (not hover-only). Touch has no hover → a tap goes straight to the word card.
- **Reduced motion:** honor `prefers-reduced-motion: reduce` everywhere — opacity/fades stay, transforms/blur drop (see `§Motion`).
- **Responsive collapse:** below 1024px the margin channel collapses to tap-expand chips under each turn (comprehension floor stays one tap away); below 640px the tool rail and word-card become bottom sheets; the spine is always present.

## Known gaps

- **Dark / focus-reading mode** is sketched (`surface-dark`) but not fully specified — TBD.
- **Dialect typography** (different orthographic conventions, Arabizi) is out of scope — deferred with dialect content.
- **The skeleton-forward vowel treatment** (tinting ḥarakāt lighter than the consonant skeleton) is an optional variant, not the default — default renders ḥarakāt in full `ink`.
- **Optional pronunciation/ASR surfaces** are deferred with the speaking feature.
- **Detailed motion specimens / numbers** beyond the `§0` token set live in [`docs/plans/motion-spec.md`](docs/plans/motion-spec.md); reconcile both in the same PR when motion changes (per the `AGENTS.md` Update-Triggers table).
