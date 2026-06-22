# language-agent — v2 Design Plan (capable agent + the learning medium)

> **Status: planning artifact.** This is the build-ready synthesis of the five v2 research briefs
> (`research/v2-agent-ux`, `v2-two-axis-progression`, `v2-structure-swap-mode`, `v2-learning-path-service`,
> `v2-architecture`) against the locked v1 spec (`50-v1-design-spec.md`) and the design system
> (`DESIGN.md`). It defines the v2 product, the two-axis progression model, the structure-swap mode, the
> agent-with-tools UX, the learning-path service + override UI, the revised architecture + schema deltas,
> and exactly what carries over from v1 vs. what changes. The last section (§8) is the concrete
> `screenList` for the Figma **brainstorm-v2** page. Everything reuses the `DESIGN.md` tokens verbatim —
> no new hexes, no new fonts, no third brand color.

---

## 1. The v2 product framing — a capable agent that *is* the learning medium

v1 was a "reading desk": a 3-column tutor whose only job was reading-from-zero. The user **explicitly
rejected** that framing for v2. v2 is a **capable conversational AI agent** the user actually talks to for
real work — it runs **web searches**, analyzes **uploaded documents**, and holds open conversation — and
that same agent is the **medium** through which the user learns to read and write Arabic. The learning is
not a separate mode; it is the *register every assistant reply is rendered in*. You use the agent to get a
real answer, and the answer arrives in a progressive English↔Arabic blend that advances as you learn.

This reframe forces three things:

1. **Conversation-first, one stream.** Drop the 3-column desk. The whole app is a single vertical,
   RTL-aware **message stream** on warm paper (`canvas #fbf9f4`) with a **composer** docked at the bottom
   and a **collapsible left sidebar** (threads / word-list / persona / settings). The v1 margin does not
   disappear — it **demotes** from a fixed right column into a per-message **annotation tray** under each
   bubble (exactly how v1 already behaved below 1024px). The margin was never load-bearing as a *column*;
   it was load-bearing as a **comprehension floor one tap away**, and that survives.

2. **Two registers in one stream, one discipline.** The agent emits two visually opposite kinds of
   content: the assistant's **blended Arabic prose** (RTL, pedagogically annotated, the star) and its
   **tool chrome** (web-search cards, doc citations, tool-activity strips — mostly Latin, LTR,
   utilitarian). The rule that keeps them from fighting: **tool chrome is quiet** — `surface-soft` /
   `latin-body-sm`, collapsed by default, calm; **prose is loud** — `arabic-reading-lg`, status-tinted,
   vowel-faded. Tools are *lenses on one conversation, never separate modes* (v1's locked principle, carried
   straight in).

3. **The blend applies only to the assistant's generated prose.** The user's search query, source titles,
   and the `cited_text` quotes from web/doc evidence are **verbatim foreign data** and stay in their source
   language — never blended into Arabic. (This extends v1's "English fallback is never marked wrong":
   tool data is its own register, not a learning surface.)

The north star is unchanged: **zero → reading formal, unvocalized MSA.** v2 widens the *reason to show up*
(a genuinely useful agent) without changing the *thing being taught* or the verified-blend engine that
teaches it.

---

## 2. The two-axis progression model — vocabulary × structure

The core v2 idea: the v1 single "blend ratio" splits into **two decoupled dials**.

- **VOCABULARY (V) — *which words* render in Arabic.** Replies start mostly English with high-frequency
  Arabic content words woven in; as the user **confirms** words, more words render in Arabic *inside the
  still-English-structured sentence*. A per-word ratchet.
- **STRUCTURE / GRAMMAR (S) — *whose rules* govern the sentence.** Independent of vocabulary, the
  grammatical structure migrates English→Arabic: word order (VSO), noun-adjective agreement, definiteness
  (`ال`), and the iḍāfa construct. A 6-stage ladder.

These are **orthogonal**. You can be Arabic-heavy on words but still reading English word order, or read
English words in Arabic order. That decoupling is what the product *is* — it must be shown as **two
controls**, never one fused slider (which hides the decoupling) and never a free 2-D scatter pad (too
abstract for a beginner).

### 2.1 The vocabulary axis (V0→V5) — a per-word ratchet that breathes

Generated as full verified Arabic, then **anglicized down by subtraction** to the user's level (the v1
generate→verify→anglicize pipeline, unchanged). At low V only the highest-frequency, already-confirmed
content words surface in Arabic; as V rises, more content words (then some function words) render Arabic.

**Confirming a word is the advance event.** A word enters `new` (gold wash, full ḥarakāt) on first Arabic
appearance; the user confirms it via the word-card ("I know this" / correct unprompted use in writing / N
spaced re-encounters), moving `learning → known`, which **simultaneously** (i) lets it render Arabic more
readily and (ii) fades its vowels. This is the v1 mastery state doing both jobs from one primitive. A
word-click is a soft "I didn't know this" and **breathes the word back** toward `learning` — vowels
re-appear, the word can drop back to English. The vocab axis is not monotonic.

### 2.2 The structure axis (S0→S5) — the genuinely new surface

Independent of which words are Arabic, the sentence's *grammar* migrates English→Arabic in demonstrable
stages, each tied to **one** concrete Arabic rule:

| Rung | Rule | Example transform |
|---|---|---|
| **S0** | English structure (SVO, adj-before-noun, "the…of…", explicit "is") | "the red book" |
| **S1** | Adjective moves *after* the noun | "the book red" |
| **S2** | Definiteness via `ال` + adjective definiteness agreement; drop the copula "is" in equational sentences | "the-book the-red"; "the-house big" = *the house is big* |
| **S3** | iḍāfa (construct state): "the door of the house" → "door the-house" (juxtaposition, no "of") | possessed noun drops `ال`/tanwīn |
| **S4** | VSO word order (verb fronts the subject) | "wrote the-boy the-letter" |
| **S5** | Full gender/number agreement + case/mood endings (iʿrāb) — the last wall | the same final vowels the vowel-fade strips last |

Crucially, **S renders even when the words are still English** — that is the structure-swap "grammar
trainer" (§3). Structure shifts are made legible by a **one-time inline "structure note"** the first time a
new rule appears ("Arabic puts the adjective after the noun — notice 'book red'"), then it goes silent;
training wheels that fade, matching the product thesis.

> **iʿrāb is one shared "last wall."** Case/mood endings are both the S5 structure rule *and* the last
> vowels the fade strips. Keep them on one shared track so the two axes never fight over the final vowel
> (this also reconciles with the v1 two-track vowel fade, where case-endings drop first/pausal).

### 2.3 How the two axes are shown and controlled

Three surfaces, in increasing weight — **stamp teaches, sliders control, map orients**:

1. **Per-reply twin-dot state stamp (always on, cheapest).** Two ~4px dots in the assistant bubble's
   leading corner (RTL: top-right): a **gold** dot filled to this message's V level, a **teal** dot filled
   to its S level. Tooltipped ("vocab 3 · grammar 2"). It passively teaches the two-axis mental model on
   every turn without opening any panel. This is the default; the controls below are summoned.

2. **Twin-dial panel (the controls).** A collapsible composer-adjacent tray, *not* a left rail. Two stacked
   horizontal sliders on one shared 6-notch track: top = **Words** (gold `status-new` fill, ا/a glyph icon,
   notches "mostly English" → "mostly Arabic"); bottom = **Grammar** (teal `primary` fill, reorder-arrows
   icon, notches "English order" → "Arabic order"). Each track carries a faint **vertical "auto" tick**
   showing where the learning-path service would set it; dragging away flips a small **"custom" pill** (the
   override). The v1 **vowel `Full · Minimal · Off` slider** stays as a third, finer control in the same
   tray.

3. **2-D "you are here" path map (the orientation reveal).** A ~120×120px inset (hover-expand) in the dial
   panel: x = vocab, y = structure, warm-paper canvas, hairline grid; a single warm-gold dot = current
   position; a ghosted diagonal = the auto-path; faint gridlines at the named stages; four corner labels =
   the named modes. Tapping a cell previews "what a reply looks like here." This is the **one place the
   decoupling is shown literally** — off-diagonal positions are visibly legal — but it is the *reveal*, not
   the default glance (lead with the stamp + sliders; a beginner models progress as one line).

**The comprehension governor couples the two dials even though the user controls them independently.** Two
hard dials can stack two novelties and crash below the **95% coverage floor** (`unknownTokenShare ≤ 0.05`,
v1 §3). Guard: a governor caps combined novelty per turn; if the user maxes both, the generator still
introduces new items gradually and the dial shows a soft **"stretching"** state rather than obeying
literally. Coverage is the constraint; the two dials are the freedom within it.

---

## 3. The structure-swap mode — render words in one language, grammar in another

The two independent dials produce four quadrants. The diagonal `English/English` is plain chat;
`Arabic/Arabic` is the natural end-state; the **off-diagonals are the two trainers**:

- **(A) English words in Arabic structure = a *grammar trainer*** (the flagship). Read words you already
  know, arranged the Arabic way, so syntax is learned with **zero vocabulary load**. "The new teacher read
  the student's book" → **`read the·teacher the·new book the·student`** (verb-first; adjective trails its
  noun and copies its definiteness; "student's book" becomes the construct "book the-student"). This is the
  evidence-backed *mother-tongue mirroring* method and the genuinely novel teaching surface.
- **(B) Arabic words in English structure = a *vocab trainer*** (lighter secondary). Arabic content words
  slot into familiar English word order, so new vocabulary is met without the grammar tax. Largely
  duplicates v1's vocab blend with familiar order — useful, lower-priority, **recognition-only** (never let
  the user *produce* in mode B or it fossilizes English word order).

### 3.1 Rendering principle — one surface line, mapping revealed on demand

**Never show two full parallel sentences.** The sentence is always shown in its surface (swapped) order;
the mapping to natural order is revealed on demand through three layered devices (three-tier disclosure):

1. **Constituent colour-bands (always on in swap mode).** Tint each constituent's *background* by
   grammatical role, reusing the **two existing status washes as role-bands** so we add **zero new colours**
   (protecting scarce-teal):
   - **verb** = teal wash (`status-learning-bg #dcebe8`)
   - **noun phrase** = no wash (the default, most frequent)
   - **adjective** = gold wash (`status-new-bg #f6ecd2`)
   - **iḍāfa / construct** = a hairline bracket in `accent-gold #b8860b` spanning possessed+possessor
   - **definiteness `ال`** = a thin teal underline on the article clitic

   Role is conveyed by wash position **plus a redundant tiny role label** (`V`, `ADJ`, `DEF`), never colour
   alone (WCAG 1.4.1).

2. **Reorder arrows (toggle: "show natural order").** Thin `muted #8a8275` curved connectors map each
   swapped word to where it would sit in the other language's order; animate once on toggle (250ms draw,
   respecting `prefers-reduced-motion`), then rest as static guides — motion teaches the transformation,
   stasis keeps it readable.

3. **Interlinear stack (tap a constituent → expand).** Tapping a constituent expands a compact 2-line IGT
   beneath *that constituent only*: line 1 = surface form, line 2 = word-aligned natural-order gloss + a
   single role chip (`VSO`, `iḍāfa`, `adj·agr·f.sg.def`). Leipzig alignment scoped to one phrase, on the
   warm-paper card surface — not a researcher's wall of glosses.

### 3.2 Direction handling — the subtle core (highest render risk)

- **Mode A** (English words, Arabic structure): bubble is `direction: rtl` (line reads right-to-left to
  teach Arabic order); each English token bidi-isolated (`<bdi>` / U+2066–2069) so Latin words don't
  scramble. Leading **⟸** direction glyph.
- **Mode B** (Arabic words, English structure): `direction: ltr`; Arabic tokens isolated inside the LTR
  flow. Leading **⟹** glyph.
- A persistent **direction-indicator** glyph (`muted`, 14px, accessible label "reads right-to-left — Arabic
  order") at the bubble's leading edge tells the learner which order they're reading.

### 3.3 Swap-mode discipline (gotchas, locked as rules)

- **Mirror one structure per turn.** Reordering every constituent yields gibberish that teaches nothing.
  The agent foregrounds **one** target structure per reply (this turn = VSO; next = iḍāfa) and the
  colour-band spotlights only that structure.
- **Free-morpheme constraint bites Mode A.** You can't prefix `ال` onto "teacher." Render Arabic-structure
  definiteness/agreement as **annotations on the English word** (a `DEF` chip, an agreement tie), never as
  letters glued to an English stem. No fabricated "al-teacher."
- **Case endings (iʿrāb) marked conservatively** in swap mode — show GEN inside an iḍāfa (structurally
  load-bearing), suppress full case marking early.
- **Screen-reader order = logical/spoken order**, never the scrambled visual order; expose the natural-order
  gloss as the accessible text.

Structure-swap is **not a third render architecture** — it's the same per-token pipeline with the structure
dial pulled independently of the vocabulary dial; the renderer adds a `role` field and a `surfaceOrder` from
the morphology pass.

---

## 4. The agent-with-tools UX — web search + document upload, conversation-first

### 4.1 The composer carries the new powers

A single rounded-`lg` `compose-bar` (RTL input retained) gains a left control cluster, matching the
converged big-four placement so it reads as "a real agent":

- **(a) Attach** (paperclip → file / Drive / library picker) — uploaded files appear as **doc chips**
  (`surface-strong`, `rounded.pill`: file-type glyph + truncated name + "12 pp" + ×) on a row above the
  input, persisting as conversation context.
- **(b) Web-search toggle** (a teal pill that lights when armed — `surface-strong`/`muted` off → `primary`
  teal + label "بحث الويب / web" on; a legitimate scarce-teal brand moment; agent decides search by default,
  the pill is an auto/always/never override).
- **(c) Trainer-keyboard toggle** (carried from v1, right side).
- Send is the primary pill. A `latin-caption muted` disclaimer microcopy line sits above.

### 4.2 The assistant turn is layered, not flat

A single assistant message contains, top to bottom:

1. **Tool-activity strip** (optional). A collapsed-by-default accordion (`surface-soft`, `rounded.sm`,
   `latin-label`, **never RTL**): running (spinner + "searching…" / a quiet teal shimmer line),
   done (check + "بحثت في الويب · searched the web · 4 sources" / "read report.pdf"), error
   (`correction-remove` dot). Expands to show the query + per-step list. This keeps the long agentic
   `pause_turn` legible as *progress, not hang*, and keeps tool noise **out of** the reading surface.
2. **Blended prose** in `arabic-reading-lg` — **the star, unchanged from v1**: every Arabic token
   clickable, status-tinted, vowel-faded, bidi-isolated; English scaffolding in `english-recede` grey.
3. **Source / citation rail** (optional), docked under the message.
4. **Margin-note tray** (replacing the right column): expandable chips by kind.

### 4.3 The three-tier citation system (one component, two payloads)

Adopt the converged answer-engine pattern for **both** web and doc grounding — same component, swap the
payload:

1. **Inline citation marker** — a superscript **gold numeral** (`accent-gold #b8860b`, manuscript-footnote
   feel, on-brand), rendered **LTR-in-RTL** and bidi-isolated. **Anchored to an English-scaffolding token or
   end-of-clause, keyed to a token ID — never injected mid-Arabic-word** (it would corrupt the four
   contextual letter forms).
2. **Hover / tap source card** (reuses the `word-card-popover` shadow tier — the only floating element):
   header = favicon + title + `page_age`; body = the `cited_text` quote in its **source** language
   (verbatim, italic, **NOT blended**); footer = "open source ↗". For a **doc** source: doc title + "p. 5" /
   chunk badge instead of favicon, and "open in document" pushes a right **doc drawer** (an overlay, not a
   permanent column — never reintroduce a third column).
3. **Source rail** under the turn: a horizontal row of numbered metadata chips (`badge-pill`,
   `surface-strong`), collapsed by default below ~3 sources, "see all 8" expander. The "Sources / المصادر"
   label migrates en→ar as the blend matures (reuse v1's `noteLang` migration rule).

A **"grounded" margin note** (gold-accented) lets a beginner who can't yet read the Arabic answer still
trust its provenance: plain-English "This came from {source}."

### 4.4 The two-register rule, restated as the core hazard

**RTL × LTR tool chrome is the single biggest layout hazard.** Search cards, code blocks, citation
numerals, and filenames are LTR; the prose is RTL. **Bidi-isolate every embedded Latin run, pin tool cards
to a stable side**, render Eastern Arabic-Indic numerals LTR-in-RTL, and keep all tool surfaces in the
quieter `surface-soft` / `latin-body-sm` register, collapsed by default. **Stream order** (v1's rule holds):
blended `tokens` first (paint the reading surface < 1s on non-searched turns), then `corrections`/`margin`,
then tool-result parts; show "searching…" immediately.

---

## 5. The learning-path service + override / progress UI

The placement service is the brain that reads the learner's accumulated signals, decides **where they are**
on the 2-D journey, and sets both axis dials **automatically**, while letting the user push back with
humane, *announced* overrides.

### 5.1 The model — `place(signals) → {vocab, structure, confidence}`

A pure function run **async off the hot path** (in the learner-model service alongside FSRS; the chat hot
path only *reads* the two cached dial values, resolving `override ?? computed`).

- **Vocab axis (continuous, coverage-driven).** Aggregate confirmed lemmas, weight by corpus frequency
  rank, compute a frequency-coverage %, map to 0–100. The 98%/95% coverage cliff is the **coherence
  ceiling**: the dial may rise only while predicted unknown-token share stays ≤ 2–5%. Signal trust ranking
  (from v1): correct unprompted **production** > explicit "I know this" confirm > FSRS R ≥ 0.9 on a due word
  > passive read (weak) > **word-click = soft "didn't know" (negative)**.
- **Structure axis (discrete ladder, production-driven).** A rung is "mastered" only via **correct
  production** (the corrector confirms the user produced a grammatical iḍāfa, correct agreement, etc.) —
  *reading it doesn't count*, because recognition ≠ production for grammar. Position = highest contiguous
  rung cleared on the S0–S5 ladder. Structure deliberately **lags** vocab (you learn words before you
  rearrange grammar); the default trajectory ramps vocab first, structure second.

The four named **modes** (start → vocab trainer → grammar trainer → full Arabic) are just orientation
labels; the structure-swap modes fall out **for free** as presets ("grammar trainer" = pin structure high,
hold vocab low; "vocab trainer" = the inverse). No separate mode system.

### 5.2 AUTO vs MANUAL — the thermostat (the most trust-critical interaction)

Default is **AUTO**: placement recomputes after each session and nudges the dials at a **capped slew rate**
(≤ 1 frequency band and ≤ 1 grammar rung per session, so the chat never lurches). A manual nudge enters a
**HOLD** with three thermostat flavors:

- **This chat** (session hold — reverts when this conversation ends)
- **Until I resume** (sticky — shown as a persistent banner)
- **Make this my pace** (a durable offset AUTO respects going forward — auto still moves, but around the
  user's bias)

Re-assertion is **announced, never silent**: when AUTO is about to cross a dial the user previously held,
it asks in the margin — *"You've confirmed 12 words and nailed agreement 5× — ready to let more render in
Arabic? [Advance] [Not yet]"* — animated, dismissible, never blocking the chat. This is the antidote to the
research's "why is it suddenly speaking more English to me?" trust-break. **Never let mastery *silently*
lower a dial**; forgetting (R decay) surfaces as a gentle "let's re-warm these," not a punishing reversal.

### 5.3 The "where am I" progress UI

- **Dual-axis path tracks (primary view).** Two stacked horizontal tracks in a collapsible **progress
  panel** (the recontextualized margin, not a separate page): top = **Vocabulary** (manuscript-gold
  `#b8860b` frequency-coverage bar, "you are here" knob, faint CEFR-band ticks A1…B1); bottom = **Structure**
  (teal `#0f766e`, **segmented** into the grammar rungs — definiteness · agreement · iḍāfa · VSO · case —
  filled rungs solid, current rung pulsing, locked rungs hairline). Each track carries `+`/`−` nudge
  affordances at its right edge.
- **2-D "you are here" mini-map** (the reveal that makes decoupling legible — same object as §2.3's path
  map): the one place off-diagonal positions are shown as legal. Tap to expand to a full journey view.
- **Auto/Manual segmented toggle** (reuse `vowel-slider` geometry): `AUTO · HOLD`; in HOLD, a sub-row of the
  three hold-flavor pills + a "Resume auto" text button in primary teal.
- **Re-assertion nudge card** — a `margin-note-encourage` variant (teal wash `#dcebe8`).
- **Per-axis "why am I here" disclosure** — tapping a track opens a small card grounded in the **same**
  word-list/FSRS data the chat already uses: vocab → "742 words confirmed · 87% of everyday text covered ·
  38 due for review"; structure → "iḍāfa: 5/8 correct uses — 3 more to unlock VSO."
- **Override slew preview (inline ghost).** Dragging a dial re-renders the next assistant reply **live as a
  ghost preview** behind an "Apply" confirm — "more Arabic" / "more Arabic grammar" is *felt*, not abstract,
  using the existing token tints + vowel fade.
- **Cold-start onboarding (no quiz wall).** A 4-tap calibration: pick a comfort start ("I know zero Arabic"
  → both dials near 0; optional "recognize these?" with 6 high-frequency words to seed the confirmed set).
  Falls back to a CEFR/frequency prior and shows **low confidence honestly** (a fuzzy dot, not a precise
  one) until hundreds of signals accrue.

> **Anchor every "where am I" claim in the existing word-list/FSRS data.** The progress panel is a
> *read-view* on the one per-(user, lemma, sense) primitive everything already depends on — do not build a
> parallel progress store.

---

## 6. Revised architecture + message-schema deltas

v2 keeps the v1 verified-blend engine intact and adds three deltas: (1) the orchestrator becomes a
**tool-using agent** (web search + doc RAG); (2) the **structure axis** decouples from vocabulary; (3) a
**learning-path service** emits the two dial values with override storage. The hard problem is composition —
**a searched, cited answer must still pass through the verified blend.**

### 6.1 The forced two-stage turn: cite-then-blend

**The load-bearing constraint: Citations ⊕ Structured Outputs = 400.** Anthropic's Citations API
interleaves citation blocks with prose; Structured Outputs forces a strict JSON schema; the API rejects
both in one call. v1's entire hot path is a single structured-output call emitting `tokens[]`. So v2
**cannot** make one call both search-and-cite *and* emit the blend token array. This forces a two-stage
pipeline — which is conveniently just the v1 generate→verify→anglicize ordering with a research stage
prepended:

- **Stage A — Research & Compose (cited, NOT structured).** ONE agentic Messages call with `web_search` +
  uploaded `document` blocks + `citations.enabled`. Claude decides whether to search/retrieve and emits a
  **fully-vocalized MSA answer with interleaved citation blocks** — `sources[]` (web
  `web_search_result_location` and/or doc `char/page/content_block_location`), each anchored to a character
  span of the MSA prose. This is v1 step 1, tool-augmented and register-pinned MSA. **`structureStage` is
  passed into Stage A's cached rubric** ("emit the matrix sentence in {English|Arabic} structure") — because
  word order/agreement/iḍāfa must be *generated*, not subtracted.
- **Stage B — Verify, Blend, Structure-shift (the v1 engine, deterministic + cheap, no 2nd generation).**
  The MSA prose enters the existing pipeline: dediac round-trip · CAMeL membership · CATT consensus →
  tokenize → anglicize `status < familiar` words → vowel-fade by subtraction. **Citations ride along as
  stand-off annotations keyed to the surviving token IDs.** A web/doc-sourced answer is thus rendered in the
  verified blend *for free*, because the blend is a post-process over verified Arabic and citations were
  attached before tokenization. The `cited_text` quote is NOT blended.

### 6.2 Services

Keep the v1 four-service decomposition (orchestrator TS · arabic-svc Python · tts-svc · learner-model-svc);
add capabilities and exactly **one** new service:

- **web search** = a server-tool *inside* the existing orchestrator Messages call (`web_search_20260318`),
  not a microservice. `max_uses: 3` default on conversational turns (15+ reserved for explicit research),
  `response_inclusion: "excluded"` to drop raw search blocks from output tokens.
- **doc ingestion** = a thin parse→chunk→Files-API step writing to Neon/R2 (`file_id` reuse, `cache_control`
  on the doc body). **Pin parser version per `file_id`** so `content_block_location` indices don't drift and
  rot cached citations.
- **`path-svc`** = the one genuinely new service: a **stateless** inference service reading `word_state`
  (FSRS) + `typing_mastery` + a fixed structure-feature ladder, emitting `{vocabStage, structureStage,
  confidence}`, writing a *computed* and an *override* value per axis. No LLM call in the placement path.
  Starts as the v1 ceiling heuristic; the DKT/BKT swap is a later internal change.

### 6.3 Message-schema deltas (additive only — v1 tolerant-reader discipline)

No field renames. The v1 envelope (`tokens[]`, `corrections[]`, `margin[]`, `blend{}`, stand-off keyed to
**stable token IDs, never raw offsets**) is preserved. Additions:

```jsonc
{
  "type": "tutor-message",
  "schemaVersion": "2.0",
  // blend{} envelope generalized from one ratio to two axes:
  "progression": {
    "vocabStage": 3, "structureStage": 2,     // the two dials (0..5), drive the twin-dot stamp
    "vocabSource": "auto", "structureSource": "custom",  // auto | custom (override) | hold
    "renderMode": "blend",                    // blend | grammar-trainer | vocab-trainer
    "coverage": 0.96, "governor": "ok",       // ok | stretching (comprehension-cliff guard)
    "movedReason": null                       // "advanced-vocab" | "breathed-down:error-spike" | null
  },
  "tools": [                                   // what ran this turn (drives the tool-activity strip)
    { "id": "tool0", "kind": "web_search", "state": "done", "query": "…", "useCount": 2 }
  ],
  "sources": [                                 // normalized web + doc, the citation rail payload
    { "id": "s1", "kind": "web", "title": "…", "url": "…", "pageAge": "…",
      "citedText": "…", "citedLang": "ar", "encrypted": "…" },          // citedText NEVER blended
    { "id": "s2", "kind": "doc", "docTitle": "…", "page": 5, "chunkId": "c12", "citedText": "…" }
  ],
  "attachments": [                             // user-turn doc chips, persist as context
    { "id": "a1", "filename": "report.pdf", "pages": 12, "fileId": "file_…",
      "parserVersion": "v3", "status": "ready" }   // parsing | ready | error
  ],
  "tokens": [
    { "id": "t1", "lang": "ar", "kind": "word",
      // ...all v1 fields (diac, skeleton, vowelState, lemma, senseId, root, pattern,
      //    upos, feats, status, confidence, glossRef, audioRef)...
      "structureStage": 2,                     // per-token structure rung in effect
      "role": "verb",                          // verb | np | adj | idafa | def — drives swap-mode washes
      "surfaceOrder": 0,                        // position in swapped order (structure-swap)
      "citationRefs": ["s1"]                    // stand-off → sources[]; anchored to this token ID
    }
  ],
  "margin": [
    { "id": "n2", "kind": "structure",         // NEW note kind: VSO / iḍāfa / agreement / definiteness
      "anchorTokenId": "t1", "body": "Arabic puts the verb first — Verb-Subject-Object.",
      "lang": "en", "oneShot": true },         // logged so it never repeats
    { "id": "n3", "kind": "grounded",          // NEW note kind: provenance for a beginner
      "anchorTokenId": "t1", "body": "This came from {source}.", "lang": "en" }
  ]
}
```

Carry the v1 SSE discipline: stream `tokens` first; `encrypted_content`/`encrypted_index` passed back
**verbatim** on every follow-up turn (opaque, never parsed or blended); map every `cited_text` span to
**stable token IDs at tokenization time** (a span anglicized away re-anchors to the English fallback token
or the clause); disable proxy buffering. **Web search adds an unbounded latency tail** — non-searched turns
keep the v1 < 1s hot path untouched; searched turns show "searching…" immediately. **Verify only the emitted
MSA answer prose**, never the raw retrieved evidence (diacritizing a 2,000-word search result is cost
death). **Structure-swap Mode A bypasses the Arabic verification stack** (no Arabic words to diacritize) but
needs a *grammaticality* judge on the Arabic structure — don't route English tokens through CAMeL
membership, it rejects every token.

---

## 7. What carries over from v1, what changes

### Carries over verbatim (validated, recontextualized inside the agent turn)

- **The verified-blend engine** — generate→verify→anglicize→fade; the trust stack (dediac round-trip · CAMeL
  membership against the intended sense · CATT consensus · refutation jury); GREEN/YELLOW/RED gating; the
  learner never sees red. Unchanged.
- **The one primitive** — per-(user, lemma, sense) `word_state` driving FSRS, the blend, the vowel fade, and
  the correction policy. Now *also* feeds `path-svc`.
- **Clickable words** → meaning + root/pattern breakdown + audio (the `word-card-popover`, the only shadowed
  element). The "I know this" confirm is now the **vocab-axis advance event**.
- **The vowel fade** (full → minimal → bare, by subtraction from one verified form), **word-status tints**
  (new/learning/known), **margin notes**, **blend-aware corrections** (sage/terracotta diff, margin-only,
  never inline), the **trainer keyboard** + label fade (per-key typing mastery).
- **The warm-paper, Arabic-first design system** — `canvas #fbf9f4`, teal `#0f766e`, manuscript gold
  `#b8860b`, Amiri/Inter/JetBrains Mono, RTL-first, scarce-teal, progress-as-typography. **No new tokens.**
- **RTL/bidi correctness** — every token bidi-isolated; logical chars not glyphs; Eastern Arabic-Indic
  numerals LTR-in-RTL.

### Changes

- **Layout: 3-column reading desk → one conversation-first RTL stream** + bottom composer + collapsible left
  sidebar. The margin **demotes** from a fixed column to a per-message annotation tray. (The desk is
  explicitly retired.)
- **Blend: one ratio → two decoupled dials** (vocabulary × structure), surfaced as twin sliders + 2-D path
  map + per-reply twin-dot stamp.
- **New structure axis** (S0–S5 ladder) + **structure-swap mode** (grammar trainer / vocab trainer) — a
  generation-time instruction to Stage A, plus role-band rendering, reorder arrows, and scoped interlinear.
- **The agent gains tools** — web search + document upload, conversation-first, with the three-tier citation
  system (marker → hover card → rail) for both web and doc grounding, and collapsed tool-activity strips.
- **New `path-svc`** + the thermostat AUTO/HOLD override model + the dual-axis progress UI.
- **Schema: v1.0 → v2.0**, additive — `progression` (replacing/generalizing `blend`), `tools[]`,
  `sources[]`, `attachments[]`, per-token `structureStage`/`role`/`surfaceOrder`/`citationRefs`, and the new
  `structure` + `grounded` margin-note kinds.
- **New margin-note kinds** — `structure` (teaches VSO/iḍāfa/agreement/definiteness when the grammar axis
  advances) and `grounded` (provenance for web/doc claims).

### Defers (unchanged from v1's YAGNI list, plus v2-specific)

Speaking/ASR; 2nd target language; dialect/Arabizi content; per-user FSRS optimization/DKT (path-svc starts
heuristic); mobile-native. v2-new defer: the DKT/BKT swap inside `path-svc`; production in structure-swap
Mode B (recognition-only in v2).

---

## 8. Figma screen list — the brainstorm-v2 page

Six screens, each reusing `DESIGN.md` tokens and v1 components, recontextualized into the
conversation-first agent. (Specified in detail in the structured `screenList` accompanying this plan.)

1. **Agent chat — web-search reply in the blend** (the v2 spine).
2. **Document upload + cited reply in the blend** (doc grounding + doc drawer).
3. **Two-axis progression control + 2-D path map** (twin sliders, stamp, map, AUTO/HOLD).
4. **Structure-swap mode** (grammar trainer Mode A + vocab trainer Mode B, role-bands + reorder arrows +
   interlinear).
5. **Learning-path "where am I" + overrides** (dual-axis tracks, thermostat hold, re-assertion nudge, ghost
   preview).
6. **Later-stage reply — the endpoint** (Arabic structure + mostly-Arabic vocab, mostly-bare vowels).
