# Design — Language-Router Gateway (`lexercon.com`)

**Status:** draft for review · **Date:** 2026-07-03 · **Feeds:** design → Figma → design-review → implementation

> A quiet root gateway at `lexercon.com` that lets a visitor choose Arabic or
> Chinese and routes into that instance. It is the product's only
> language-neutral surface. This spec also resolves the standing frontend
> architecture inconsistency (the per-language app is coded same-origin with
> relative `/api/`, while the deploy IaC targeted Cloudflare Pages).

## Decisions locked in brainstorming

| # | Question | Decision |
|---|----------|----------|
| 1 | What is this page? | **Quiet language-picker gateway** — not a marketing landing, not an auto-redirect. Brand wordmark + one tagline + two language cards. |
| 2 | URL + serving | **Apex router + path routes** — `lexercon.com/` is the router; `lexercon.com/ar/*` → `la-ar`, `lexercon.com/zh/*` → `la-zh` via Cloudflare edge routing (prefix stripped). One origin. |
| 3 | Card visual | **Script as the hero** *(chosen on the user's behalf while AFK — override at the review gate if wanted)* — each card leads with the language's own script in its reading face; English name beneath. |

## 1. Purpose & scope

The gateway is the first thing a visitor to `lexercon.com` sees. Its single
job: present the two languages as equals and route the visitor into the one
they pick. It carries no lesson content, no live model, no marketing scroll.

**Out of scope (deferred):** marketing/explainer content, auto-detect &
redirect, remembering the last choice, dark mode, i18n of the gateway's own
chrome. Any of these can be a later enhancement.

## 2. URL & serving architecture (resolves the frontend inconsistency)

Everything lives under one origin, `lexercon.com`:

```
lexercon.com/            → router gateway (static)
lexercon.com/ar/*        → (Cloudflare edge) → la-ar Cloud Run  (UI + /ar/api)
lexercon.com/zh/*        → (Cloudflare edge) → la-zh Cloud Run  (UI + /zh/api)
```

- **Edge routing:** a Cloudflare rule matches the `/ar/` and `/zh/` path
  prefixes and forwards each to its Cloud Run backend, **stripping the prefix**
  and setting the origin Host to that service's `run.app` host (the same
  Host-override pattern that lets Cloudflare front a `run.app` URL without a
  Google-verified domain mapping). Each Cloud Run backend therefore keeps
  serving `/api/*` and its static UI unchanged — it never sees the prefix.
- **Base-path-aware apps:** each per-language app is built with a Vite `base`
  of `/ar/` or `/zh/`, so the HTML it emits references assets and calls its API
  at prefix-relative URLs (`/ar/api/stream`, `/ar/assets/…`). The browser hits
  `lexercon.com/ar/api/stream`; the edge strips `/ar` → the backend sees
  `/api/stream`. This is what makes the app's existing relative `/api/` code
  correct under one origin — **no cross-origin API, no CORS.**
- **Router hosting:** the static gateway is served at the apex by Cloudflare
  Pages (repurposing the existing `frontend_pages` module, which previously —
  and incorrectly — targeted the per-language apps).
- **Hosting-ADR amendment:** this supersedes the deploy IaC's original intent
  (Pages hosts the per-language apps). The per-language apps are served by
  their own Cloud Run services under path routes; Pages serves only the router.
  Reconcile `docs/decisions/hosting-*.md`, `INSTANCE.md`, and the Terraform in
  the implementation PR.

> **Implementation note (not design):** the exact Cloudflare mechanism
> (Ruleset `http_request_origin` + a rewrite, vs. a Pages `_redirects`/Function,
> vs. a Worker) is an implementation-plan decision; the design constraint is
> only *"one origin, prefix-routed to two backends, prefix stripped, app
> base-path-aware."*

## 3. Layout & components

A single centered column on warm paper — no rails, no chrome. New components
(to add to `DESIGN.md §Components` in the implementation PR):

- **`router-page`** — full-viewport `canvas` (#fbf9f4), centered column,
  max-width ~640px, generous vertical rhythm (`spacing/section` breathing room).
- **`router-wordmark`** — "lexercon" in **Inter**, `ink`, at `arabic-display`
  scale or `latin-title-lg` — quiet, not shouted. Optional small `accent-gold`
  brand glyph. One teal or gold moment at most (DESIGN.md scarcity rule).
- **`router-tagline`** — one line, `latin-body`, `muted`. Placeholder copy:
  *"a quiet way to read a new language."* **(final copy TBD with user.)**
- **`language-card`** (×2) — `surface-card` (#fff, elevated), `radius/lg`,
  `hairline` outline, flat (no shadow — depth is layout). The whole card is a
  semantic `<a href="/ar/">` / `<a href="/zh/">`.
  - **Arabic card:** `العربية` in **Amiri** at `arabic-display` (40px), wrapped
    in a Unicode bidi isolate (U+2066–2069) with `direction: rtl` and
    `lang="ar"`; English name **Arabic** beneath in `latin-title-md`, `muted`.
  - **Chinese card:** `中文` in **Noto Serif TC** at a size optically matched to
    the Arabic (Han glyphs read larger at equal px — tune in Figma), `lang="zh-Hant"`;
    English name **Chinese** beneath, same treatment.
  - Cards sit **side-by-side ≥640px, stacked below**. Equal size — neither
    language is visually primary (this is why Arabic leaves the apex).

## 4. Motion (per DESIGN.md §Motion — calm, fade-signature, no bounce)

- **Entrance:** a calm opacity fade-in on load (`duration/base` 200ms,
  `ease/standard`), the two cards very lightly staggered. No transform on entry
  beyond a few px of settle.
- **Hover / focus:** a gentle teal wash (surface shifts toward
  `status-learning-bg`) + a few-px lift, `duration/fast` (120ms). `focus-visible`
  shows the `primary` focus ring.
- **Reduced motion:** `prefers-reduced-motion: reduce` → keep opacity/wash,
  drop transforms; never `transition: all`. (DESIGN.md §Motion rule 5.)
- No shake, no spring on this surface — reading-first calm.

## 5. Accessibility

- Each card is a real `<a>`: keyboard-reachable, `focus-visible` `primary` ring,
  ≥44px target (AAA). Enter/Space activate; tab order Arabic → Chinese.
- **Bidi:** the Arabic script is bidi-isolated and `direction: rtl`; page chrome
  is LTR. Chinese is LTR. `lang` attributes set per card (`ar` / `zh-Hant`) and
  on `<html lang="en">` for the chrome.
- **Contrast:** WCAG AA — `ink`/`muted` on `canvas`/`surface-card` clear AA;
  the teal hover wash sits behind `ink` text, so meaning never rides on color.
- **Fonts:** Amiri, Noto Serif TC, Inter — all already bundled by the
  per-language apps; the router **subsets** each to just the glyphs it shows
  (`العربية`, `中文`, the wordmark + tagline) to stay a tiny static payload.
- **Responsive:** cards stack below 640px; scripts scale down gracefully; the
  wordmark and tagline stay centered.

## 6. Never-show-wrong

The gateway renders only **fixed, correct labels** — `العربية` and `中文` are the
languages' own endonyms, not generated target text. There is no model, no
blended sample, no verification surface, so the never-show-wrong gate does not
apply here. (This is a deliberate reason script-hero was chosen over a
live-sample card: no dependency on gate-verified copy on a static page.)

## 7. Testing

- **Visual:** renders correctly desktop + mobile; Arabic shapes RTL correctly in
  Amiri; Chinese renders in Noto Serif TC; cards equal-weight.
- **Routing:** `/ar/` and `/zh/` links resolve to the correct instance; edge
  prefix-strip + app base-path verified end-to-end (asset + `/api` URLs resolve).
- **A11y:** keyboard nav, focus ring, reduced-motion, AA contrast, `lang` attrs,
  bidi isolation — automated (axe) + manual.
- **Pipeline:** this spec → Figma frames on the WIP page → in-Figma design review
  (DESIGN.md rubric) → issue authoring → implementation.

## 8. Open questions for the user (review gate)

1. **Tagline copy** — placeholder is *"a quiet way to read a new language."*
2. **Card visual** — I chose **script-as-the-hero** while you were away;
   confirm, or switch to living-sample / minimal-nameplate.
3. **Wordmark** — is "lexercon" the confirmed product name shown here, and do we
   want the small gold brand glyph, or wordmark only?
4. **Return-visit memory** — v1 always shows the gateway (no auto-redirect).
   OK to defer "remember my language" to a later enhancement?
