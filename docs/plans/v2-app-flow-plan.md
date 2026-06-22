# 91 · End-to-End App Flow — Build-Ready Plan

> **Status: build-ready spec for a new Figma page** in file `mFjP4XMgcvdwzloZL9EMze`.
> **Page name:** `v2 · App Flow (End-to-End Journey)`
>
> This page documents the **connective application journey** — the screens a real product needs to take a
> user from signed-out → onboarded → chatting → managing their account — and the happy-path flow between
> them. It is **not** the deep feature interactions; those already live on the `brainstorm-v2` page as
> mocks 01–07 and are *referenced*, never rebuilt, here.
>
> It composes one source of truth for the visual language — [`DESIGN.md`](../../DESIGN.md) (warm paper
> `#fbf9f4`, scarce teal `#0f766e`, manuscript gold `#b8860b`, Amiri / Inter / JetBrains Mono, status
> tints, RTL-first, single shadow tier) — plus the already-bound color variables + 14 text styles in the
> Figma file. **Never hardcode a hex or a font; bind the variable / apply the text style.**

**Scope at a glance:** 9 full-screen journey screens · 4 phases (Auth → Onboarding → Core → Account) ·
1 persistent app shell defined once and reused on every Core/Account screen · 3 reuse-references to
existing `brainstorm-v2` mocks (01 Agent chat, 05 Learning path) · 1 single named container frame
nesting the whole page · explicit happy-path + secondary-nav connector graph.

---

## 1. Frame format + app shell / navigation model

### 1.1 The resolved frame format — **one size for all nine screens: 1200 × 800**

Each of the nine specs independently recommended **Desktop 1200 × 800**, and the rationale converges, so
this is the committed format for the whole page with **no dissent to reconcile**:

- **Why 1200×800.** v2 is a reading-first, three-register desktop tool: an RTL Arabic conversation spine,
  LTR tool chrome, and a dense margin/word-list. `DESIGN.md §Layout` caps the *reading desk* at ~1200px
  and holds the reading measure at ~640px; the persistent left rail, twin-dial tray, source rail, and
  trainer keyboard all want horizontal room. Mobile (390-wide) is a **documented downstream breakpoint**
  (`DESIGN.md §Responsive`: tool rail → bottom sheet, margin → tap-chips, word-card → bottom sheet), not
  the IA's primary frame. Onboarding deliberately *pre-figures* the same window so signed-out → chatting
  reads as one product.
- **The single rule:** every frame on this page is exactly `1200 × 800`, fill `canvas #fbf9f4` (warm
  paper — never `#ffffff`, which is reserved for elevated cards/bubbles). No exceptions, no per-screen
  resizing.

**Spec adjustments required to fit the one format** (the specs are 95% consistent; these are the deltas):

| Screen | Spec said | Adjust to (for consistency) |
|---|---|---|
| `progress-word-list` | left sidebar **220px** | **240px** (match the canonical shell width below) |
| `S1-settings` | left sidebar **248px** | **240px** |
| `C1-chat-first-run` | left rail **76px icon-only** | Keep an **icon rail at 76px is fine for chat**, BUT to keep ONE shell, adopt the **240px labelled sidebar** as the canonical Core/Account shell and treat the 76px icon-rail as the *collapsed* state of that same sidebar (document both; build the 240px expanded form as the default on C1 so the shell is identical everywhere). |
| `account-profile` | sidebar **240px** | already canonical — keep. |
| Auth + Onboarding (A1, A2, O1, O2, O3) | no shell (correct — pre-auth/pre-app) | unchanged; they intentionally have **no** sidebar. |

> **Net:** one 240px labelled sidebar is the canonical Core/Account shell. C1 is built in its expanded
> 240px form (its 76px icon-rail is the documented *collapsed* variant, not a second shell).

### 1.2 The app shell / navigation model (Core + Account screens only)

The shell is **built identically** on `C1-chat-first-run`, `progress-word-list`, `S1-settings`, and sits
behind `account-profile` (which is a centered sheet over the dimmed shell). Auth and Onboarding have **no
shell**.

**LEFT SIDEBAR — persistent global nav. Build once as a component/frame and reuse.**

- **Frame:** width **240px**, full height (800), fill `surface-soft #f3efe6`, **1px right edge**
  `hairline #e4ddcd` (depth = warm band + hairline, never shadow). Inner padding `spacing.base (16)`.
- **Top — brand lockup:** a **28px gold circular glyph** (`rounded.full`, fill `accent-gold #b8860b`,
  a single white Amiri letter inside — `arabic-token`) + wordmark **`language·agent`** in
  `latin-title-md` (Inter 18/600) `ink #1a1612`, middot in `muted #8a8275`. This is the lone gold brand
  moment in the shell. `spacing.xl (32)` below.
- **Primary nav list** (`nav-link` Inter 14/500, row height 40, `rounded.sm`, 18px line icon + label,
  `spacing.xs` gap, padding `8×12`). Items, top→bottom:
  - **New chat** — `body #574f45` label, `muted #8a8275` icon.
  - **Chat** *(or "Threads")* — `body`.
  - **Progress & words** — `body`.
  - **Settings** — `body`.
  - **ACTIVE state (per screen):** the row matching the current screen gets fill `surface-strong #ece6d9`,
    label `ink`, icon `primary #0f766e`, and a **3px `primary #0f766e` left-edge accent bar**. This is the
    rail's single scarce-teal moment. (On C1 → "Chat" active; on `progress-word-list` → "Progress & words"
    active; on `S1-settings` → account row active, see below.)
- **Spacer (flex)** pushes the account block to the bottom.
- **Bottom — account row (the entry point to `account-profile`):** full-width row, `rounded.md`, padding
  `8×12`. A **32px circular avatar** (`rounded.full`, warm gold→teal placeholder, initials `SL` in
  `latin-label` `on-primary`/`muted`), name **`Sample Learner`** (`nav-link`, `ink`), trailing 16px chevron
  `muted`. Hover/selected = `surface-strong #ece6d9` wash; when Settings is the active context this row
  also carries the 2px `primary` left inset bar.

**MAIN AREA — to the right of the sidebar (x = 240 → 1200, width 960), fill `canvas #fbf9f4`.** Each Core
/ Account screen owns this region. The content column is editorially centered at **max-width ~720px** for
the calm single-column reading feel (Settings, Progress header), except Chat, whose conversation column
fills the area with its own internal ~640px reading measure.

**Scarce-teal discipline in the shell:** the active-nav teal accent is the shell's one teal moment;
everything else (icons, labels) is `muted`/`body`. Gold appears once (brand glyph). No third color, no
second shadow tier.

---

## 2. Screen map (9 screens, grouped by phase)

| Phase | Key | Title | One-line purpose |
|---|---|---|---|
| **Auth** | `A1-sign-in` | Sign in | Signed-out entry; brand + one-move return sign-in (Google primary, email magic-link fallback). |
| **Auth** | `A2-create-account` | Create account | New-user sign-up (name/email/password or Google); the mirror of A1, one product line. |
| **Onboarding** | `O1-onboarding-goal-language` | Onboarding 1/3 — Goal & Language | Welcome + confirm the single locked goal (read MSA zero→unvocalized); sets the 3-step frame. |
| **Onboarding** | `O2-onboarding-word-seeding` | Onboarding 2/3 — Word Seeding | No-quiz vocabulary calibration; tap recognized words to seed the opening VOCAB dial. |
| **Onboarding** | `O3-onboarding-pace-first-blend` | Onboarding 3/3 — Pace & First Blend | Confirm pacing defaults, live-preview the first blended reply, discharge the "never wrong Arabic" promise. |
| **Core** | `C1-chat-first-run` | Chat — first run (app shell) | The app home + the canonical shell; first-run empty chat with greeting, suggested prompts, composer. |
| **Core** | `progress-word-list` | Progress & Word List | "Where am I / what do I know" — two-axis tracks + searchable, filterable personal word library. |
| **Account** | `S1-settings` | Settings | Account / Learning / Notifications / Privacy & data — global defaults behind the per-message controls. |
| **Account** | `account-profile` | Account / Profile | Light identity sheet — avatar/name/email, momentum stats, plan ("could grow" hook), sign-out. |

---

## 3. The flow — happy path + secondary nav + page layout

### 3.1 Happy-path connections (explicit arrow list)

```
A1 ──"Create an account"──▶ A2          (new user branches off sign-in)
A2 ──"Sign in"────────────▶ A1          (returning user branches back)

A1 ──auth success (new acct)──▶ O1      (first-run → onboarding)
A2 ──account created──────────▶ O1

O1 ──"Continue"───────────▶ O2
O2 ──"Continue"───────────▶ O3
O3 ──"Start chatting"─────▶ C1          (handoff into the app)

A1 ──auth success (returning)──▶ C1     (returning user skips onboarding, straight to chat)

O1 / O2 / O3 ──"Skip" / "Skip setup"──▶ C1   (escape hatch lands in chat with defaults)
O2 ──"Back"──────────────▶ O1            (reverse within onboarding)
O3 ──"← Back"────────────▶ O2
```

### 3.2 Secondary nav (the persistent shell links — the connective tissue of the app)

```
C1 (shell) ──rail "Progress & words"──▶ progress-word-list
C1 (shell) ──rail "Settings"──────────▶ S1-settings
C1 (shell) ──rail account row─────────▶ account-profile

progress-word-list ──rail──▶ C1 · S1-settings · account-profile   (shell is identical → any-to-any)
S1-settings ───────rail──▶ C1 · progress-word-list · account-profile
account-profile ─────────▶ C1 · progress-word-list                 (sheet closes back into shell)

S1-settings ──"Sign out"────────▶ A1     (account → auth, the door out)
account-profile ──"Sign out"────▶ A1
```

> Because the shell is built identically on all three Core/Account screens, the rail makes them
> **mutually reachable**; draw the four shell-link arrows once from C1 (the hub) to P/S/AC and add a small
> "(shell · any-to-any)" note rather than a full mesh, to keep the diagram readable.

### 3.3 Page layout on the Figma canvas — phase columns, left → right

Lay the nine frames out as **four vertical phase lanes** reading **left → right** (Auth → Onboarding →
Core → Account), inside the single named container frame. Each lane is a labelled column; frames stack
vertically within a lane; connector arrows run between frames.

```
┌─ CONTAINER FRAME: "App Flow — End-to-End Journey" (warm paper) ───────────────────────────────────┐
│  TITLE BAND  "v2 · App Flow"  (latin-title-lg, ink) + subtitle (latin-body-sm, muted)             │
│                                                                                                   │
│  LANE 1: AUTH        LANE 2: ONBOARDING       LANE 3: CORE            LANE 4: ACCOUNT             │
│  ┌──────────┐        ┌──────────┐             ┌──────────┐            ┌──────────┐                │
│  │   A1     │──new──▶ │   O1     │──▶ O2 ──▶ O3 │   C1     │──rail──▶  │   S1     │                │
│  │ Sign in  │◀─back─┐ │ Goal 1/3 │             │  Chat    │           │ Settings │                │
│  └──────────┘       │ └──────────┘   (3 stacked│  (shell  │──rail──▶  ┌──────────┐                │
│  ┌──────────┐       │ ┌──────────┐    O-frames)│   hub)   │           │  AC1     │                │
│  │   A2     │───────┘ │   O2     │             └──────────┘           │ Account  │                │
│  │ Create   │         │ Seed 2/3 │      O3 ─────▶ C1 (Start chatting) │ Profile  │                │
│  └──────────┘         └──────────┘                                    └──────────┘                │
│        │ A1/A2 auth-success ─────────────▶ O1                  S1/AC1 "Sign out" ─────▶ A1 (dashed)│
│        └ A1 returning ─────────────────────────────────────▶ C1                                    │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Layout mechanics:**
- **Lane gutter:** 160px between lanes (room for connector arrows + labels); **48px** (`spacing.xxl`)
  vertical gap between stacked frames within a lane.
- **Lane header:** above each lane, a phase label in `latin-label` (uppercase, `muted`) — `AUTH` ·
  `ONBOARDING` · `CORE` · `ACCOUNT` — with a tiny `accent-gold` dot, so the four phases read as columns.
- **Connector arrows:** 1px `hairline #e4ddcd`→`muted #8a8275` stroke, small arrowhead. Two-line text
  label: line 1 = the trigger (`latin-label`, `ink`, e.g. `"Continue"`, `"Start chatting"`, `rail link`),
  line 2 = optional condition (`latin-caption`, `muted`, e.g. `"new account"`, `"returning user"`).
- **Solid vs dashed:** **solid** arrows = forward happy path; **dashed** arrows = reverse/back, skip, and
  sign-out (the door out). Auth↔Auth (A1↔A2) and O↔O back links are dashed.
- **The returning-user fast path** (A1 → C1) is drawn as a longer solid arrow that hops Lane 2, labelled
  `"returning · skips onboarding"`.

---

## 4. Per-screen build spec

> For every screen: **frame** = a 1200×800 frame, fill `canvas`, **meaningfully named** (no default
> "Frame"). **All hexes via bound variables; all type via the 14 text styles.** RTL + bidi-isolate every
> Arabic run; all chrome is LTR. Below is the consolidated, build-ready spec per screen — see the source
> JSON for exhaustive pixel detail; here is the canonical, reconciled version.

### A1 · Sign in  — frame `Auth / A1 — Sign in`
- **Shell:** none (pre-auth, full-bleed editorial spread). 1px vertical hairline `#e4ddcd` at x≈680 splits
  two fields.
- **LEFT HERO FIELD (0→680):** warm-paper. Hero motif = the word **ٱقْرَأْ** (*iqraʾ*, "read", imperative),
  fully vocalized, Amiri ~150px (`arabic-display` family/weight), `ink` at **~10% opacity** — a manuscript
  ghost, RTL, bidi-isolated, bleeding slightly off the left edge (decorative, not a UI element). Over it,
  the live brand block: 28px **gold** glyph (`accent-gold`, `rounded.full`) → wordmark `language·agent`
  (`latin-title-lg`, `ink`) → tagline (`latin-body`, `body`, max-w 320) → muted credibility line
  (`latin-caption`, `muted`): "Web search · document analysis · your own pace."
- **RIGHT AUTH PANEL (680→1200):** the sign-in **CARD** — `surface-card #ffffff`, `rounded.lg`, 1px
  `hairline` border, **no shadow**, width 360, padding `spacing.xl (32)`. Stack: heading "Welcome back"
  (`latin-title-md`) + subhead (`latin-body-sm`, `muted`) → **PRIMARY** "Continue with Google"
  (`button-primary`, `primary` teal fill, `on-primary`, `rounded.pill`, h44, multicolor G mark) → divider
  "or sign in with email" (`latin-label`, `muted` on hairline-soft) → Email field (`text-input`) → "Send
  magic link" (`button-secondary`) + "Use a password instead" (`button-text`, teal) → footer "New here?
  Create an account" (`button-text`, teal → A2).
- **Bottom chrome (y≈760):** one quiet legal line (`latin-caption`, `muted-soft`).
- **Tokens/styles:** `button-primary`, `button-secondary`, `button-text`, `text-input`, `latin-*`,
  `arabic-display`. **Teal exactly twice** (Google fill + the two text links count as the link voltage);
  **gold once** (brand glyph).
- **Key states:** Default · Password-mode (reveal masked field + "Sign in" rendered as `button-secondary`
  to keep one teal action + "Forgot password?" teal text) · Magic-link sent (collapse to confirmation
  panel, `correction-add` sage check, Resend / different-email text links) · Loading (quiet teal shimmer
  line, label dims to `primary-disabled`) · Error (input border → `correction-remove`, inline helper) ·
  First-run = identical to Default.
- **Reuse:** none.

### A2 · Create account — frame `Auth / A2 — Create account`
- **Shell:** none. Two regions only.
- **Brand lockup (top-left, x48 y40 — editorial, not centered):** 28px gold disc (`status-new-bg #f6ecd2`
  fill, gold Amiri `ا` `arabic-token`, `ink`) + wordmark `language·agent` (`latin-title-md`, `ink`,
  middot `muted`). No teal here.
- **AUTH CARD (centered, ~y128):** `surface-card #ffffff`, width **440**, `rounded.lg`, 1px `hairline`,
  **no shadow**, padding `spacing.xl (32)`, vertical gaps `spacing.lg`. Header: H1 "Create your account"
  (`latin-title-lg`) + the ONE product line (`latin-body`, `body`): "A conversational AI agent that
  teaches you to read Arabic — one real conversation at a time." → **Google** button (`button-secondary`
  geometry, `surface-strong`, full-width, G mark + label) → divider "or" (`latin-caption`, `muted`) →
  form: Name / Email / Password fields (`text-input`, `rounded.md`, h46) with inline "Show" (`button-text`
  teal) + helper "8+ characters." (`latin-caption`, `muted`) → **PRIMARY CTA** "Create account"
  (`button-primary`, `primary` teal — the scarce-teal moment, disabled `primary-disabled` until valid) →
  legal microcopy (`latin-caption`, `muted`, Terms/Privacy as teal `button-text`).
- **Footer link (below card):** "Already have an account? Sign in" (`button-text` teal → A1).
- **Key states:** Default (CTA disabled) · Focused field (1.5px `primary` ring, no glow) · Filled+valid
  (CTA solid teal) · Password visible (Show↔Hide) · Inline validation error (`correction-remove` border +
  helper) · Submitting (inline spinner, no layout shift) · Email-already-in-use (`surface-soft` band +
  teal "Sign in instead") · Google OAuth in progress (button spinner "Connecting…", form dimmed 60%).
- **Reuse:** none.

### O1 · Onboarding 1/3 — Goal & Language — frame `Onboarding / O1 — Goal & Language`
- **Shell:** none (focused pre-app flow). Two-pane split meeting at **x=520**.
- **LEFT PANE — EDITORIAL HERO (0→520):** fill `surface-dark #1a1612` (DESIGN.md reserves surface-dark for
  the onboarding hero), padding 64/72/56. Brand lockup top-left (gold glyph `ن` in `on-dark` + wordmark
  `latin-label`, `on-dark-soft`). Hero block centered: Arabic display line **«اِقْرَأْ الْعَرَبِيَّةَ»**
  (`arabic-display`, `on-dark`, RTL, fully vocalized) → English promise "Read Arabic — from zero to
  unvocalized text." (`latin-title-lg`, `on-dark`) → body (`latin-body`, `on-dark-soft`, max-w 360). The
  **vowel-fade proof strip** (~y560): three bidi-isolated tokens left→right — «كِتَاب» on `status-new-bg`
  wash (NEW, full ḥarakāt) · «كتاب» on `status-learning-bg` wash (LEARNING, minimal) · «كتاب» plain
  `on-dark` (KNOWN, bare) — caption "kitāb · book — the same word, as you master it." (translit in
  `transliteration` style). Footer micro-line (`latin-caption`, `on-dark-soft`).
- **RIGHT PANE — CALIBRATION CARD (520→1200):** warm paper, content column max-w 440. **Top utility:**
  "Skip for now →" (`button-text`, teal, right-aligned). **Progress indicator:** 3-segment pill track
  (each 6px tall, `rounded.pill`); seg 1 filled `primary`, segs 2&3 `surface-strong`; label "STEP 1 OF 3 ·
  CALIBRATION" (`latin-label`, `muted`). **Headline:** eyebrow "YOUR GOAL" (`latin-label`, `accent-gold`)
  → title "Let's confirm what you're here to do." (`latin-title-lg`) → body (`latin-body`, `body`).
  **THE GOAL CARD** (confirmation centerpiece, NOT a choice list): `surface-card`, `rounded.lg`, 1px
  `hairline`, padding `spacing.lg`. 40px gold glyph `أ` → title "Read Modern Standard Arabic"
  (`latin-title-md`) → desc (`latin-body-sm`, `body`) → `hairline-soft` divider → 2-row fact list (teal
  check + "Target locked to Formal MSA" + a `LOCKED` `status-pill`; teal check + "Reading-first · writing
  via trainer keyboard"). **Motivation prompt (optional):** label "WHAT'S PULLING YOU IN? (OPTIONAL)" + 4
  `badge-pill`s (single-select; selected flips to `primary` fill). **Primary action:** "Continue"
  (`button-primary`, teal) + "Takes about a minute." (`latin-caption`, `muted`). **Reassurance footer:**
  (`latin-caption`, `muted`) — seeds the verified-blend trust promise.
- **Teal budget:** progress seg 1 + Continue (+ selected motivation pill if chosen). **Gold twice**
  (eyebrow + goal glyph).
- **Key states:** Default (Continue always enabled — confirmation step) · Motivation pill selected ·
  Continue hover/press (`primary-active`) · Skip-for-now (jumps O2/O3, dials default near 0) ·
  Reduced-motion (static proof strip).
- **Reuse:** none.

### O2 · Onboarding 2/3 — Word Seeding — frame `Onboarding / O2 — Word Seeding`
- **Shell:** none — a centered ceremonial canvas (minimal onboarding top strip + centered content).
- **TOP STRIP (h72):** brand glyph (`ع` in gold-tinted chip) + wordmark (`latin-title-md`); CENTER =
  3-step progress (seg 1 & 2 filled `primary`, seg 3 `surface-strong`) + "STEP 2 OF 3" (`latin-label`,
  `muted`); RIGHT = "Skip for now" (`button-text`, teal). Bottom hairline-soft.
- **HEADER (centered, max-w 720):** eyebrow "VOCABULARY CALIBRATION" (`latin-label`, `accent-gold`) →
  bilingual title "Do you recognize any of these?" (`latin-title-lg`) + Arabic echo «هل تَعرِفُ أيًّا مِن
  هذِه؟» (`arabic-reading-md`, RTL) → subhead (`latin-body`, `body`): "Tap the words you already know.
  This isn't a test…".
- **WORD GRID (hero, max-w 760):** 4 cols × 2 rows, 175×150 cards, 20px gaps. Each card = `surface-card`,
  1px `hairline`, `rounded.lg`, **no shadow**: vocalized Arabic word (`arabic-display` 40px, `ink`, RTL,
  full ḥarakāt) + transliteration (`transliteration`, `muted`). The 8 words: كِتاب/kitāb, بَيت/bayt,
  ماء/māʾ, كَبير/kabīr, يَوم/yawm, شُكراً/shukran, مَدرَسة/madrasa, جَديد/jadīd. **SELECTED state** (show
  cards 1 & 6 selected): fill `status-learning-bg #dcebe8`, 1.5px `primary` border, a 24px `primary`
  success-check badge in the RTL top-RIGHT corner (`on-primary` check), translit → `primary-active`. Hover
  = border → `muted-soft`, 1px lift, no shadow.
- **SECONDARY OPTION ROW:** wide chip (`surface-soft`, `rounded.pill`, h44) "I don't know any of these
  yet" with a leading unchecked-radio outline — a first-class, unpunished answer (both dials seed near 0).
- **FOOTER ACTION BAR:** left live count "2 selected" (`latin-body-sm`, `muted`); right = "Back"
  (`button-text`, teal → O1) + "Continue" (`button-primary`, teal, always enabled).
- **Teal budget:** progress segs + 2 selected washes/checks + Continue (~3, justified — calibration is the
  job). **Gold once** (eyebrow + glyph). Arabic is the largest type (40px), lh≥1.5.
- **Key states:** Default (8 unselected, "0 selected") · Partial selection (cards 1 & 6, "2 selected") ·
  Hover · Tap success-check micro-moment · "I don't know any" chosen · Skip/Back · Loading-next (CTA
  spinner while seed writes).
- **Reuse:** none.

### O3 · Onboarding 3/3 — Pace & First Blend — frame `Onboarding / O3 — Pace & First Blend`
- **Shell:** none — onboarding shell = centered single-column card on bare paper (top bar h56 + progress
  rail). Top bar: brand glyph `ع` (gold) + wordmark (`latin-title-md`); right "Skip setup" (`nav-link`,
  `muted`). Progress rail: 3 segments, all 3 filled `primary` (seg 3 = current) + "Step 3 of 3"
  (`latin-label`, `muted`).
- **MAIN CARD (centered, max-w 720):** `surface-card`, `rounded.lg`, 1px `hairline`, **no shadow**, padding
  40, vertical rhythm 24. **Header:** eyebrow "FINAL STEP" (`latin-label`, `accent-gold`) → title "Set your
  pace, then we'll start." (`latin-title-lg`) → subtitle (`latin-body`, `body`). **SETTING ROW 1 — AUTO
  pacing:** `surface-soft` band, `rounded.md`, with label "Automatic pacing" (`latin-title-md`) + a
  "RECOMMENDED" `badge-pill` (recolored to `status-learning-bg` fill / `primary-active` text) + helper
  (`latin-body-sm`, `muted`); RIGHT = ON toggle (44×26 `rounded.pill` track `primary`, white knob right).
  **SETTING ROW 2 — Starting vowels:** label "Vowel marks" + helper; RIGHT = the **`vowel-slider`**
  component (3-segment Full·Minimal·Off, `surface-strong` track; **Full** selected = `vowel-slider-selected`
  `primary` fill, `on-primary`). **LIVE PREVIEW BLOCK** (the emotional payload): header "PREVIEW · YOUR
  FIRST REPLY" (`latin-label`, `muted`) + twin-dot state stamp (gold dot ~20%, teal dot 0%, tooltip "vocab
  1 · grammar 0"); preview surface = `canvas` inset panel `rounded.md` 1px `hairline` holding ONE
  `bubble-assistant` (`surface-card`, `rounded.xl`, RTL, max-w 520, 24px gold persona avatar `ع`).
  **Content:** recede-grey English "Of course — let's start. Here is your first word:" → gold NEW token
  **«مَرْحَبًا»** (*marḥaban*, full ḥarakāt, `token-arabic-new`) → recede grey "— it means \"hello.\" Tap
  any Arabic word…". Below: one demonstration `margin-note-gloss` chip with Mono translit "marḥaban" +
  gloss, faint hairline connector. **TRUST STRIP:** `status-learning-bg` band, `rounded.md`, 18px shield
  glyph (`primary-active`) + text (`latin-body-sm`, `primary-active`, matching `margin-note-encourage`):
  "Every Arabic word above was checked by our verifier before you saw it. **We never show you incorrect
  Arabic** — if we're unsure, we fall back to English." (the clause in 600). **CTA ROW:** "← Back"
  (`button-text`, teal → O2) + **"Start chatting"** (`button-primary`, teal, trailing arrow — the one loud
  teal moment → C1). **Footer microcopy** (`latin-caption`, `muted`) reinforces reversibility.
- **Teal budget:** AUTO toggle + Full vowel segment + Start-chatting CTA (3, justified) + the trust strip's
  `primary-active` text. **Gold:** brand glyph + eyebrow + NEW word wash only.
- **Key states:** Default · Live-preview loading (teal shimmer line + skeleton chip) · Vowels→Minimal/Off
  (preview word re-renders «مَرْحَبًا»→«مرحبا», fade-by-subtraction) · AUTO toggled OFF (track →
  `surface-strong`, honest inline note) · Word-card hover on preview word (the ONLY floating element =
  `word-card-popover`, the one shadow tier) · Skip setup (toast → chat) · Submitting (CTA `primary-active`
  + inline spinner).
- **Reuse:** **`01 Agent chat`** (the preview bubble reuses the `bubble-assistant` render from that mock).

### C1 · Chat — first run (app shell) — frame `Core / C1 — Chat (first run + shell)`
- **Shell:** **YES — the canonical 240px sidebar** (build it here as the master, reuse on the others), with
  the "Chat" nav row ACTIVE (`surface-strong` fill, `primary` icon + label, 3px `primary` left bar). New
  chat "+" and the bottom account row present; thread list empty at first run.
  *(Documented variant: the 76px icon-only rail is the collapsed form of this same sidebar — do not build a
  second shell.)*
- **CONVERSATION COLUMN (x 240→1200):** three stacked bands on `canvas`.
  - **A. PERSONA HEADER** (h64, `surface-soft`, bottom 1px `hairline`, padding `12×24`): 36px `primary`
    persona dot + name **سَلْمى** (`arabic-token` ~22px, `ink`, RTL-isolated) + "your Arabic-learning
    agent" (`latin-body-sm`, `muted`); right = quiet "New chat" (`button-text`, teal).
  - **B. STREAM (first-run/empty, measure ~640):** ONE `bubble-assistant` (`surface-card`, `rounded.xl`,
    1px `hairline`, padding `20×24`, RTL, `arabic-reading-lg`): low-V/low-S blend, mostly `english-recede`
    with TWO gold NEW tokens **سَلْمى** and **عَرَبِيّ** (`token-arabic-new`, `status-new-bg`, full
    ḥarakāt, individually clickable). Twin-dot stamp top-right (gold ~1/5, teal ~1/5, tooltip "vocab 1 ·
    grammar 1"). **SUGGESTED PROMPTS:** label "Try asking" (`latin-label`, `muted`) + 3 `button-secondary`
    chips (`surface-strong`, `rounded.pill`): "What's the capital of Morocco?" · "Summarize a document
    I'll upload" · "Teach me 3 everyday Arabic words". **Trust hint:** (`latin-caption`, `muted`) "I never
    show you incorrect Arabic — every word is verified." with a tiny `correction-add` tick.
  - **C. COMPOSER (docked bottom):** disclaimer "Salma can make mistakes — verify important info."
    (`latin-caption`, `muted`, centered) above a **`compose-bar`** (`surface-card`, `rounded.lg`, 1px
    `hairline`, minH48, RTL, `arabic-reading-md` placeholder «اِسْأَلْني أَيَّ شيء…» in `muted`). LEFT
    control cluster (LTR): Attach · Web search · Keyboard (`button-secondary` rest). RIGHT: Send
    (`button-primary`, teal, disabled `primary-disabled` while empty).
- **Teal budget (≤2):** active-nav indicator + Send/persona dot share the action/brand voltage; Web pill
  neutral until armed. **Gold:** rail brand glyph + the new-word washes only.
- **Key states:** First-run/empty (default rendered) · Returning/populated (turns fill, prompts gone, "+"
  & thread list active, Send enabled) · Composer focused (RTL caret, Send → teal) · Web-search armed (pill
  → `primary` + `on-primary` "بحث الويب · web") · Hover Arabic new-word (quick-peek tooltip) · Rail hover
  tooltips / account menu · Loading (tool-activity strip with teal `shimmer-text` "searching…").
- **Reuse:** **`01 Agent chat`** (this IS that deep mock, shown in its full shell to define the IA once).

### P1 · Progress & Word List — frame `Core / P1 — Progress & Word List`
- **Shell:** **YES — canonical 240px sidebar**, "Progress & words" nav row ACTIVE. Bottom: persona chip +
  account row. *(Spec's 220px → use 240px to match the shell.)*
- **CONTENT AREA (x 240→1200, padding 32):** sticky two-axis header, scrolls below.
  - **PAGE HEADER:** H1 "Your progress" (`latin-title-lg`) + right-aligned AUTO/HOLD segmented toggle
    (reuse `vowel-slider` geometry; selected = `primary`/`on-primary`); subhead (`latin-body-sm`, `body`):
    "742 words confirmed · 87% of everyday text covered · 38 due for review".
  - **REGION 1 — TWO-AXIS TRACKS** (`surface-card` panel, `rounded.lg`, 1px `hairline`): **VOCABULARY**
    track — rail h10 `rounded.pill` `surface-strong`, filled **gold** `accent-gold` to ~87%, gold "you are
    here" knob, CEFR ticks (`muted-soft`). **GRAMMAR (structure)** track — 5 segmented rungs
    (definiteness · agreement · iḍāfa · VSO · case); filled rungs solid `primary` teal, current rung
    (iḍāfa) teal 60% + 2px ring, locked rungs `hairline` outline. +/− nudge pairs per track. Footer: "Why
    am I here?" (`button-text`, teal) + a small 2-D mini-map thumbnail (warm paper, gold dot, ghosted
    auto-path) linking to `05 Learning path`.
  - **REGION 2 — WORD LIST:** section head "Your words" (`latin-title-md`) + count `badge-pill` "742" +
    SEARCH `text-input` (placeholder "Search Arabic, translit, or meaning…"). FILTER ROW of `status-pill`s
    carrying their semantic wash (All · New gold-dot · Learning teal-dot · Known hairline-no-dot · Due for
    review 38 `confidence-uncertain` dot) + "Sort: Recently added ▾". TABLE (LTR chrome columns, Arabic
    cell RTL/bidi-isolated): WORD | TRANSLIT | MEANING | STATUS | DUE. Rows = `word-list-row`, each Arabic
    word rendered in its STATUS treatment (new = `status-new-bg` wash + full ḥarakāt; learning =
    `status-learning-bg` + minimal; known = plain `ink`, bare). Sample rows: كِتَاب/kitāb/book/LEARNING,
    مَدْرَسَة/madrasa/school/NEW, بَيْت/bayt/house/LEARNING, قلم/qalam/pen/KNOWN(bare), مُعَلِّم/muʿallim/
    teacher/NEW, بَاب/bāb/door/LEARNING, كَبِير/kabīr/big/LEARNING, وَلَد/walad/boy/NEW. DUE col in
    `latin-caption` (today → `confidence-uncertain`). Pagination "Showing 1–25 of 742" (`latin-caption`,
    `muted`). Clicking a row opens the `word-card-detail` as a right overlay drawer (not a 3rd column).
- **Teal:** active-nav accent + structure-track fill + AUTO selected + learning wash (≤2 per region).
  **Gold:** vocab-coverage fill + new-word wash + persona glyph (illustrative, never an action).
- **Key states:** Populated default · First-run/empty (fuzzy low-confidence gold dot, only seed words +
  empty-state card "Your words will collect here…" + `button-primary` "Start a chat") · Filtered Due-for-
  review · Search active · HOLD mode (banner + 3 hold-flavor pills + "Resume auto" teal) · No-results.
- **Reuse:** **`05 Learning path`** (the two-axis tracks read-view + the mini-map links out to it).

### S1 · Settings — frame `Account / S1 — Settings`
- **Shell:** **YES — canonical 240px sidebar**, account row at the bottom shown SELECTED (Settings context:
  `surface-strong` wash + 2px `primary` left inset + trailing `primary` gear glyph). *(Spec's 248px → use
  240px.)*
- **CONTENT (x 240→1200, inner column max-w 720, top pad 32, bottom 48):** eyebrow "ACCOUNT"
  (`latin-label`, `muted`) → H1 "Settings" (`latin-title-lg`) → subline (`latin-body-sm`, `muted`).
  **Section pattern** (×4): left-aligned heading (`latin-title-md` + `latin-body-sm` helper) then ONE
  `surface-card` (`rounded.lg`, 1px `hairline`, **no shadow**) holding rows (min-h64, padding `16×12`,
  `space-between`, `hairline-soft` dividers). **§1 ACCOUNT:** Email (sublabel + "Change" teal `button-text`)
  · Password ("Update" `button-secondary`) · Sign out ("Sign out" `button-text` in `correction-remove`).
  **§2 LEARNING:** Default vowels (`vowel-slider`, Full selected = teal + a `كَتَبَ` Amiri sample) · Pacing
  (AUTO/Manual segmented, AUTO selected teal) · My-pace offset (indented `surface-soft` child block, −/+
  stepper, value chip, range −2…+2) · Audio dialect (label + `VOICE ONLY` `badge-pill` + select showing
  "MSA (formal)"; rule: text always MSA) · Structure-swap default (iOS switch, OFF). **§3 NOTIFICATIONS:**
  Daily review reminder (switch ON, `primary`) · Reminder time (revealed child block, time-select). **§4
  PRIVACY & DATA:** Uploaded documents ("Manage" teal) · Export your data ("Export" `button-secondary`) ·
  Delete account ("Delete" `button-text` `correction-remove`). Footer meta line (`latin-caption`,
  `muted-soft`).
- **RTL:** chrome is LTR; the ONLY Arabic is the `كَتَبَ` sample in Default-vowels (Amiri, bidi-isolated).
- **Key states:** Default (AUTO) · Manual pacing (offset row active + "Resume auto" teal) · Delete-account
  confirm modal (420px `surface-card`, `rounded.lg`, the ONE soft shadow `0 8px 24px rgba(26,22,18,0.12)`
  over `ink` 40% scrim, type-to-confirm + Cancel + filled `correction-remove` destructive button) ·
  Notifications OFF (time sub-row collapsed) · Saved toast (`surface-dark` pill, `on-dark`, bottom-center)
  · Dialect changed (inline "Audio only — your reading text stays MSA").
- **Reuse:** none (but surfaces the global defaults behind brainstorm-v2 03/04/05 per-message controls).

### AC1 · Account / Profile — frame `Account / AC1 — Account Profile`
- **Shell:** the canonical sidebar persists behind, **dimmed ~40% with an `ink` 40% scrim**
  `rgba(26,22,18,0.4)`; the account row at the sidebar foot is the activated affordance.
- **THE SCREEN = a centered ACCOUNT SHEET (modal), not a full page** (honors "keep light"): 480px wide,
  ~560px tall, centered, `surface-card #ffffff`, `rounded.lg`, the **ONE allowed shadow tier**
  `0 8px 24px rgba(26,22,18,0.12)` (this is a floating surface, like the word-card popover), padding
  `spacing.xl (32)`. Header row: "Account" (`latin-title-lg`) + 24px close ×; `hairline-soft` divider.
  - **REGION 1 IDENTITY:** 72px avatar (warm gold→teal placeholder, "SL" `latin-title-lg` `on-primary`) +
    20px gold edit-badge → name "Sample Learner" (`latin-title-md`) + pencil glyph → email (`latin-body-sm`,
    `muted`) → "MEMBER SINCE FEB 2026" `badge-pill`.
  - **REGION 2 MOMENTUM** (read-view on word-state/FSRS, no parallel store): eyebrow "YOUR ARABIC"
    (`latin-label`, `muted`); 3-up stat tiles on `surface-soft` (`rounded.md`): **STREAK "14"** in
    `latin-title-lg` **`primary` teal** (the one scarce-teal moment) + tiny teal spark; WORDS KNOWN "742"
    (`ink`); COVERAGE "87%" (`ink`). Beneath: word-of-the-streak flourish — كِتَاب rendered as
    `token-arabic-learning` (`status-learning-bg` wash, `ink`) + Mono translit + caption (`latin-caption`,
    `muted`). Arabic stays the star even here.
  - **REGION 3 PLAN (the "could grow" hook, understated):** eyebrow "PLAN"; row "Personal" (`latin-title-md`)
    + "FREE" `badge-pill` + subline; the scale hook = "Bring others in someday →" (`button-text`, **teal**)
    revealing a one-line muted roadmap note. No price, no pressure.
  - **REGION 4 SIGN OUT:** full-width `button-secondary` ("Sign out", `surface-strong`, NOT teal) +
    app-version line (`latin-caption`, `muted-soft`).
- **Teal exactly twice** (streak number + grow hook). **RTL:** chrome LTR; only the كِتَاب flourish is RTL
  bidi-isolated.
- **Key states:** Default (populated) · First-run/fresh (streak "0" in muted ink not teal, words/coverage
  "—", flourish hidden, member-since = current month) · Avatar/name edit hover (pencil + camera, inline
  rename `text-input`) · Grow-hook expanded · Sign-out confirm (button morphs to inline "Sign out? Cancel /
  Sign out" → A1) · Loading (`surface-soft` skeleton shimmer).
- **Reuse:** none (read-view shares the FSRS/word-state primitive with `01`/`05`, no separate data store).

---

## 5. Build notes

1. **Variables + text styles only — never hardcode.** Bind every color to the already-bound DESIGN.md
   variables and apply one of the file's 14 text styles to every text node. No raw hexes, no ad-hoc font
   sizes. If a value isn't in the system (e.g. a 10%-opacity ghost), set it as an opacity on the bound
   `ink` variable, not a new hex.
2. **ONE consistent frame size.** Every screen is exactly **1200 × 800**, fill `canvas #fbf9f4` (warm
   paper). Reconcile the three sidebar widths to **240px** (see §1.1 table). No per-screen resizing.
3. **Single named container frame + meaningful names on EVERY frame.** Nest the whole page under one parent
   frame named **`App Flow — End-to-End Journey`**. Name every child frame with its phase + key (e.g.
   `Auth / A1 — Sign in`, `Core / C1 — Chat (first run + shell)`, `Account / AC1 — Account Profile`) and
   name nested groups/sections meaningfully (`Shell / Sidebar`, `O1 / Hero pane`, `P1 / Two-axis tracks`).
   **No node may keep a default "Frame"/"Group" name** — stray defaults surface as editor name-labels on
   the canvas and break the editorial finish.
4. **Build the shell once, reuse it.** Construct the 240px sidebar as a component (or a copied master
   frame) on C1, then place identical instances on `progress-word-list`, `S1-settings`, and behind
   `account-profile`. Only the ACTIVE nav row differs per screen. This guarantees pixel-identical chrome.
5. **Warm-paper canvas everywhere; `#ffffff` only on elevated cards/bubbles.** Never use stark white as a
   reading floor (`surface-card` is the one-step-brighter elevation, reserved for cards, bubbles, the auth
   card, the sheet).
6. **Scarce-teal discipline (one or two teal moments per surface).** Teal carries persona + primary CTA +
   the "learning" state only. Onboarding calibration screens are allowed ~3 (progress + selection +
   primary) because calibration is the screen's job; everywhere else hold ≤2. **No third brand color** —
   gold is illustrative (brand glyph, new-word wash), status tints are semantic.
7. **One shadow tier only.** The single licensed shadow `0 8px 24px rgba(26,22,18,0.12)` appears only on
   genuinely floating surfaces: the `word-card-popover` (O3 hover state, P1 word-detail drawer) and the
   two true modals (S1 delete-confirm, AC1 account sheet). Every other surface is flat or warm-banded with
   a 1px hairline. **No second shadow tier.**
8. **RTL where Arabic appears; LTR chrome.** All app chrome is left-to-right Inter. Every Arabic run is
   `direction: rtl` and **bidi-isolated** (Unicode isolates). Render Eastern Arabic-Indic numerals LTR
   inside an RTL run; Western numerals are fine in LTR chrome. Arabic is sized ≥ its Latin sibling at every
   level and never below 1.8 line-height — full ḥarakāt on NEW words, minimal on LEARNING, bare on KNOWN.
9. **Reuse, don't rebuild, the deep mocks.** O3 (`01 Agent chat`), C1 (`01 Agent chat`), P1 (`05 Learning
   path`) reference the existing `brainstorm-v2` screens for their deep interactions — show a reference /
   reuse the bubble + track renders rather than re-authoring those feature interactions here.
10. **Phase lanes + connectors.** Lay the 9 frames in 4 left→right phase lanes (Auth · Onboarding · Core ·
    Account) under the container, with labelled phase headers, 160px gutters, 48px intra-lane gaps, and the
    §3 connector arrows (solid = forward happy path; dashed = back/skip/sign-out).
