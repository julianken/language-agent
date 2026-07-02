# RTL/Arabic token-rendering spike — findings

> **Issue:** #5 (`walking-skeleton: RTL/Arabic token rendering spike`), part of epic #3. **Blocks:** #10 (SSE streaming + token renderer shell + `@la/lang-ar/react`).
> **Spike page:** [`rtl-rendering-spike/index.html`](rtl-rendering-spike/index.html) (self-contained scratch, committed per issue AC #4 — see "Reproducing this spike" below).
> **Result: GO for Amiri as primary, GO for Scheherazade New as fallback-only (not primary) at the current line-height; `<bdi dir="auto">` per token is the recommended markup recipe for #10. No `DESIGN.md` §0 change needed.**

## Context

`DESIGN.md` §0 specifies the Arabic type ramp (`arabic-reading-lg`, 27px / line-height 1.95), Amiri primary with Scheherazade New / Noto Naskh Arabic fallbacks, and the bidi-isolation rule (every token wrapped in a Unicode bidi isolate, preferred over embeddings) — none of it previously verified against a real browser. `arabic-validation.md` §7 (architecture-delta table, "Rendering" row) and §8 risk #7 name the concrete risk this spike tests: *"un-isolated spans, glyph-vs-logical-char operations, numerals breaking order; invisible to a non-reader operator"* and prescribe the recipe under test — `<bdi>` / `dir="auto"` per token, preferring Unicode isolates over embeddings.

## Methodology

### The page

[`rtl-rendering-spike/index.html`](rtl-rendering-spike/index.html) is a self-contained, vanilla HTML/JS/CSS page (no `package.json`, no build step, no framework — fonts loaded live as Google Fonts webfonts). It programmatically builds **6 blocks** = **2 fonts** (Amiri, Scheherazade New) × **3 markup variants**:

1. **`bdi`** — `<bdi dir="auto">` per token, the recipe `arabic-validation.md` §7 prescribes.
2. **`rli`** — explicit isolate, U+2067 RLI … U+2069 PDI (forces RTL regardless of content — correct for definitively-RTL Arabic tokens).
3. **`fsi`** — explicit isolate, U+2068 FSI … U+2069 PDI (auto-detects direction from the first strong character, like `dir="auto"` but as an isolate rather than an attribute).

Each block renders, at `arabic-reading-lg` (27px / 1.95):

- **4 standalone clickable tokens:** مَكْتَبَة (maktaba, "library"), كِتاب (kitāb, "book"), قَهْوة (qahwa, "coffee") — the issue's given examples — plus **سَلَام** (salām, "peace"), added because none of the issue's literal examples contain a **mandatory ligature** (لا, lām-alif); without it, the "ligature integrity" check would have nothing to exercise.
- **A 3-token sentence,** هٰذِهِ مَكْتَبَةٌ كَبِيرَةٌ ("this is a big library") — tests tokens rendered in running context, not just isolation.
- **Two ḥarakāt clip probes:** a single-line probe (`overflow: hidden`, height locked to exactly one `arabic-reading-lg` line box, 27×1.95 = 52.65px) and a forced 2-line wrap probe (height locked to exactly two line boxes, 105.3px) — both deliberately zero-margin stress tests.

The page exposes `window.runChecks()`, which returns `{ hitTest, roundTrip, clipping }` for every token/probe on the page — the automated checks below all read from this.

### The three checks

1. **Ligature integrity** — (a) *textual*: `el.textContent` (isolate-marks stripped) compared against the canonical vocalized string for every token (`roundTrip`); (b) *visual*: full-page and per-probe screenshots, inspected for broken/split glyph shapes, especially the سَلَام lām-alif ligature.
2. **Ḥarakāt clipping at line boundaries** — for every combining harakah (U+064B–0652, U+0670) in a token, a DOM `Range` is placed around it and `getBoundingClientRect()` compared against the enclosing clip-probe's box. A mark whose rect top/bottom falls outside the box is flagged. (Caveat: a `Range` around a single combining codepoint in shaped Arabic text returns the enclosing glyph-cluster's rect, not an isolated per-mark ink box, in all three engines — so this measures "does this token's cluster fit the line box," a coarser but still meaningful proxy for the same risk. Corroborated with screenshots.)
3. **RTL hit-testing** — for every token, `document.elementFromPoint()` at the token's visual bounding-box center, checked against `.closest('.token')` to confirm the *intended* token receives the hit, not a bidi-mis-mapped neighbor.

### A caught false positive (harness bug, not a browser bug)

The first run showed 29/84 hit-test "failures," clustered entirely in the Scheherazade-New/explicit-isolate blocks. Root cause: `elementFromPoint()` only resolves points inside the **current viewport**, and the driver's fixed 2200px viewport was shorter than the full page — tokens below that y-coordinate returned `null` regardless of correctness. Fix: read `document.documentElement.scrollHeight` and resize the viewport to the full page height before hit-testing. After the fix, hit-testing was 84/84 in all three engines (see below). Noting this because it's exactly the kind of "looks like a rendering bug, is actually a test-harness bug" trap this repo's anti-slop culture flags.

### Browsers

**Chromium, WebKit, Firefox** — via `playwright@1.60.0` (installed to the local Playwright browser cache; not added as a repo/project dependency). Run locally on **macOS (Darwin)**, not Linux/CI — see "Limitation: playwright-webkit ≠ Safari" below for why that matters.

## Results

### Round-trip (textual ligature integrity) — 84 tokens × 3 engines

| Engine | Pass |
|---|---|
| Chromium | 84/84 |
| WebKit | 84/84 |
| Firefox | 84/84 |

No dropped, hallucinated, or reordered characters in any of the 84 token/probe elements (4 standalone + 3 sentence + 3 clip-single + 4 clip-wrap = 14 tokens × 6 font×variant blocks), in either markup recipe, in any engine. Isolate-mark stripping round-tripped cleanly for both the RLI and FSI variants.

### RTL hit-testing — 84 tokens × 3 engines

| Engine | Pass |
|---|---|
| Chromium | 84/84 (after viewport fix; see above) |
| WebKit | 84/84 |
| Firefox | 84/84 |

Every token's visual center resolved to the correct element via `elementFromPoint`, in all three markup recipes, both fonts, all three engines. No bidi-mis-mapped click targets found.

### Ḥarakāt clipping

| Probe | Chromium | WebKit | Firefox |
|---|---|---|---|
| Single-line, **Amiri** | 0/12 flagged | 0/12 flagged | 0/12 flagged |
| Single-line, **Scheherazade New** | 12/12 flagged (top ≤1.0px, bottom ≤1.36px) | 12/12 flagged (top ≤0.2px, bottom ≤2.22px) | 12/12 flagged (top ≤0.67px, bottom ≤2.68px) |
| 2-line wrap, **Amiri** | 2/9 flagged, bottom-only (≤11.34px) | 2/9 flagged (≤12.38px) | 2/9 flagged (≤13.17px) |
| 2-line wrap, **Scheherazade New** | 2/9 flagged, bottom-only (≤15.34px) | 2/9 flagged (≤16.19px) | 2/9 flagged (≤16.68px) |
| Inter-line collision (either font, either probe) | 0 | 0 | 0 |

Two distinct findings, both consistent within ~1–2px across all three engines (differences attributable to per-engine font hinting/anti-aliasing, not divergent behavior):

- **Amiri comfortably fits a single `arabic-reading-lg` line** (0 flags) — confirms the 27px/1.95 pairing is correct for the primary font. **Scheherazade New is measurably tighter**: every harakah in the single-line probe reports a small (sub-3px) overflow on *both* edges, in all three engines. This is a real, reproducible signal that Scheherazade New's vertical glyph metrics run taller than Amiri's relative to its own nominal size — consistent with it being specified as fallback, not primary. The absolute magnitude is small (≤2.7px) and did not produce a visually broken glyph in screenshot inspection at this scale — not a hard NO-GO, but it does not clear the bar for *primary* at the current line-height.
- **The 2-line wrap probe's bottom-edge overflow (11–17px) is *not* font-differentiated** — it occurs for both Amiri and Scheherazade New at similar magnitude. This is a **layout-integration finding, not a font finding**: a hard `overflow: hidden` block sized to *exactly* N × line-height, with zero bottom margin, can clip the last line's descenders regardless of font. Screenshot inspection shows the visible glyphs still read cleanly (no obviously severed shapes) — the numeric measurement is the more sensitive signal. **Recommendation for #10:** never hard-clip a multi-line Arabic block to an exact line-height multiple with `overflow: hidden` and zero bottom padding; if a clipped/truncated preview is ever needed, add ~15–20px of bottom breathing room beyond the nominal N × line-height.

### Ligature integrity (visual)

Screenshot inspection (all 6 blocks, all 3 engines) confirms: (a) the سَلَام lām-alif ligature renders as a single connected glyph in both fonts and all three markup variants — no splitting, no isolated/disconnected letterforms; (b) all four-way contextual letter shaping (initial/medial/final/isolated forms) renders correctly within each token; (c) the sentence's three tokens read in correct visual right-to-left order in every variant, confirming the bidi-isolation markup doesn't corrupt line-level ordering for pure-Arabic content. No qualitative difference was observed between the `bdi`, `rli`, and `fsi` variants — expected, since all tested content is unambiguously RTL (FSI's auto-detection and RLI's forced direction converge on identical output when there's no mixed-direction ambiguity to resolve).

## Limitation: `playwright-webkit` ≠ Safari (stated per the plan review's non-gating SUGGESTION)

The plan review APPROVE (issue #5, second pass) flagged, as a non-gating SUGGESTION, that `playwright-webkit` is a weak proxy for real Safari/CoreText — Playwright's WebKit is a patched build, and on a Linux/CI runner it does not use Apple's CoreText, shaping Arabic through a different (FreeType/HarfBuzz-family) stack, which could hand back a false GO that real Safari wouldn't clear.

**This spike ran the WebKit engine locally on macOS (Darwin), not Linux/CI**, which narrows but does not close that gap: WebKit's macOS port is built against native Apple frameworks and does use CoreText-family text shaping, so this run is meaningfully closer to real Safari than a Linux CI run would have been. But it is still **not** Safari.app — it's a separate WebKit build (different version pin, no Safari-specific configuration or private-API patches) — and it is **definitely not iOS Safari**, which has its own default font set, memory constraints, and touch-hit-testing behavior that this spike does not exercise at all. **Treat this spike's WebKit results as "CI/local-WebKit-on-macOS only; real macOS and iOS Safari unverified."** If #10 ships a public-facing renderer, a manual pass on real Safari (macOS) and iOS Safari before considering RTL rendering fully de-risked is still warranted — this spike reduces that risk, it does not eliminate it.

## GO/NO-GO per font

| Font | Verdict | Basis |
|---|---|---|
| **Amiri** | **GO — primary** (as `DESIGN.md` §0 already specifies) | 84/84 round-trip, 84/84 hit-test, 0/12 clipping flags in the single-line probe, across all 3 engines. No finding contradicts its use as primary. |
| **Scheherazade New** | **GO — fallback only, NOT primary** at the current 27px/1.95 (as `DESIGN.md` §0 already specifies) | 84/84 round-trip, 84/84 hit-test — functionally correct. But universally tighter vertical fit (12/12 harakat flagged, sub-3px overflow, single-line probe, all 3 engines) means it does not have Amiri's safety margin at this line-height. If ever promoted to primary, increase line-height to roughly 2.0–2.05 first and re-run this probe. |

## Recommended markup recipe for #10

**Use `<bdi dir="auto">` per token as the default**, matching `arabic-validation.md` §7's prescribed recipe and the 84/84 pass rate measured here:

```html
<bdi class="token-arabic" dir="auto" data-token-id="tok-142">مَكْتَبَة</bdi>
```

This is functionally equivalent to the explicit-isolate variants for pure-Arabic tokens (all three recipes scored identically in every check) but is simpler: it's native HTML with no invisible control characters injected into `textContent`, so downstream consumers (copy-paste, search/highlight, TTS input extraction, the diacritization round-trip check in `arabic-validation.md` §6) don't need to remember to strip isolate marks before treating the string as the canonical form.

**Reserve explicit isolates for the one case this spike doesn't cover:** a token whose first strong character is ambiguous or LTR (e.g. a token beginning with a Latin loanword fragment, or the Eastern Arabic-Indic numerals `DESIGN.md` specifies rendering LTR-inside-RTL). There, `dir="auto"`'s first-strong-character heuristic can be steered wrong by leading neutral characters, and a forced isolate is safer:

```html
<!-- force RTL regardless of leading-character ambiguity -->
<span class="token-arabic">&#x2067;مَكْتَبَة&#x2069;</span>
<!-- U+2067 RLI … U+2069 PDI -->
```

Numeral handling itself (Eastern Arabic-Indic digits LTR-inside-RTL text) is **out of scope for this spike** — it wasn't exercised by any tested token — and should get its own verification pass in #10 or a follow-up spike.

## `DESIGN.md` §0 / `tokens.json` changes

**No change needed.** Every value this spike tested — `arabic-reading-lg` (27px / 1.95), Amiri-primary/Scheherazade-New-fallback ordering, the bidi-isolation rule — held up under measurement. This spike is a validation of the existing spec, not a revision of it.

## Reproducing this spike

Open [`rtl-rendering-spike/index.html`](rtl-rendering-spike/index.html) directly in a browser to interact with the tokens by hand (click any token; its id is logged above the blocks). To re-run the automated checks:

```js
// after navigating to the page:
await page.waitForSelector('body[data-fonts-ready="true"]');
// elementFromPoint only resolves points in the current viewport — the page
// is taller than any reasonable viewport, so size to the full page first:
const h = await page.evaluate(() => document.documentElement.scrollHeight);
await page.setViewportSize({ width: 1100, height: h + 50 });
const results = await page.evaluate(() => window.runChecks());
// results = { hitTest: [...], roundTrip: [...], clipping: [...] }
```

Screenshots taken during this spike (full-page per engine + per-probe zoomed crops) are **not committed** (binary screenshots policy) — the measurements and visual-inspection findings above are the durable record.
