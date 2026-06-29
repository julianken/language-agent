# Decisions & ideas log (live) — language-agent

> Running record of what the user has decided/proposed during brainstorming, 2026-06-21.
> Status: brainstorming, pre-design. Updated as we go. Items marked (VALIDATE) need the
> Arabic research/verification run; (OPEN) need a decision; (LOCKED) are user-confirmed.

## Locked user decisions
- **Target language: Written Arabic** (assume Modern Standard Arabic / MSA; uniformity claim to VALIDATE).
  Dialect deferred as a later voice/pronunciation modifier, not a v1 concern.
- **Learner profile: complete beginner, zero Arabic reading ability**, English L1.
- **Ambition: personal tool for the user, built so it could grow** (clean foundations, Terraform).
- **Read/write balance: balanced from v1** — NOTE the stated north star is *reading* (see below);
  worth revisiting whether "balanced" or "reading-first" better serves the actual goal.
- **Persona: one named character**, pinned/consistent, no avatar.

## Core north star (user's own words, paraphrased)
From **zero → able to read anything in Arabic**, including normal everyday (unvocalized) text — "so I
have access to all Arabic writings." Past blocker: the only vocalized practice material available was
the Qur'an, but **lack of vocabulary** was the real wall. So **vocabulary is the true gate** — which the
comprehensible-input blend + per-word glossing + mastery model is designed to solve.

## The vowel / diacritization mechanic (evolving — the heart of the product)
- Arabic is normally written WITHOUT short-vowel diacritics (ḥarakāt/tashkīl); a beginner can't supply
  them. So: **default = write everything FULLY VOCALIZED.**
- **Quick UI toggle to switch vowels on/off**, used as a self-test: once you know a word *with* vowels,
  toggle them off to check you still recognize it without. (User's proposal.)
- Long-arc trajectory: **vocalization fades** as the learner masters words, ending at reading bare
  unvocalized text.
- (OPEN) Toggle granularity: **global binary on/off** vs **partial vocalization** (show only the
  ambiguous/unknown vowels) vs **automatic per-word fade** driven by mastery. Likely hybrid: global
  manual control layered over an automatic per-word fade. (VALIDATE feasibility + pedagogy.)

## Design thesis: TWO fading scaffolds on one mastery signal
1. **Language blend** — English → Arabic density (the original "blend, then integrate").
2. **Vocalization fade** — full tashkīl → partial → none, per word.
Both driven by the **same per-(user, word, sense) knowledge state** that also feeds spaced repetition
and defines what counts as an error in correction. (No surveyed product does the vocalization fade.)

## Verification is LOAD-BEARING (user requirement)
Neither the user nor the operator (Claude/Julian) reads Arabic, so generated output — especially
**diacritization** — cannot be eyeballed for correctness. A wrong vowel teaches the wrong word
(كتب → kataba "he wrote" / kutiba "it was written" / kutub "books"). Therefore: **robust LLM-judge
ensembles + deterministic cross-checks** (morphological-analyzer / diacritizer consensus,
back-translation/round-trip, confidence gating, golden eval sets, sampled native-speaker spot-checks).
This is both a product subsystem AND the method we use to validate claims during planning.

## Claims to VALIDATE (Arabic research run)
- **C1** — All written (Standard) Arabic is uniform: written the same across regions/dialects.
- **C2** — Dialect differences are pronunciation/voice, not the written form.
- **C3** — v1 can target one uniform written standard and defer dialect to a later voice modifier.
- **C4** — The vowel-omission framing: unvocalized text is the core reading obstacle; full vocalization
  makes text sound-out-able but vocabulary is the gate; mastering reading = reading unvocalized text.

## Carried-over architecture defaults (from `20-SYNTHESIS-architecture.md`, Spanish-baseline — REVISE for Arabic)
Per-(user,word,sense) state as single source of truth; hot path = one streamed model call +
generate→validate→regenerate coherence/ratio guard; classical NLP for segment/lemma/breakdown, LLM for
contextual meaning; Cloud Run + Neon + Upstash Redis + Cloudflare R2/CDN + Terraform/OIDC; margin lags
the spine (English → simple Arabic).

## Arabic-specific deltas to resolve (VALIDATE / design)
RTL & bidirectional rendering; positional letter forms + font choice; **clitic segmentation** (articles,
prepositions, conjunctions, pronoun suffixes attach to words); **root-and-pattern (nonconcatenative)
morphology** for breakdown/lemmatization; the **auto-diacritization pipeline** + its accuracy/verification;
**TTS depends on diacritized input** to pronounce correctly (audio quality is downstream of diacritization);
whether word-level language-blending stays grammatical given Arabic word order + rich morphology;
dictionary resources (Hans Wehr, Wiktionary/Kaikki Arabic, almaany, Lane's Lexicon); MSA vs Qur'anic/Classical.

## Validation outcome (2026-06-21) — full detail in `docs/research/arabic-validation.md`
- **C1 (uniform written Arabic): Mostly true.** MSA is a genuine pan-Arab written standard — safe to target.
  Caveats: numerals differ by region (Mashriq ٠١٢٣ vs Maghreb 0123); minor orthographic conventions vary — pick & normalize ONE.
- **C2 (dialect = voice only): MOSTLY FALSE — the one real error.** Dialects differ in vocabulary/grammar/spelling
  (not just sound) and ARE written heavily online (no standard spelling; plus Latin-script Arabizi 7=ح, 3=ع).
  A dialect is different CONTENT, not a TTS voice swap.
- **C3 (MSA v1, dialect later): right decision, wrong rationale.** Ship MSA-only (also best tooling/dictionary/TTS
  support). Relabel as "teaching the formal written standard"; dialect = future curriculum, not a voice toggle.
- **C4 (vowel/diacritization framing): Mostly true — the strongest claim.** The gate is vocab + root-and-pattern
  morphology + context (not vocab alone); the hardest vowels are grammatical case-endings (iʿrāb) → the vowel fade
  is also a grammar ramp.
- **Biggest missing fact: DIGLOSSIA.** MSA ≈335M users, ~0 native speakers; it's the written/formal register.
  Reading MSA ≠ understanding spoken dialect. Onboarding must say so honestly.
- **Validated design upgrades:** partial vocalization is real/researched → the backbone of the fade, split into TWO
  tracks (lexical vowels vs case-endings; drop case-endings first). Correctness backbone: agent knows intended sense
  BEFORE vocalizing → verification = morphological-analyzer membership lookup (CAMeL Tools) + dediac round-trip +
  CATT consensus + diverse refutation jury; Claude is SOTA diacritizer (~1.39 DER). RULE: store ONE verified
  fully-vocalized form per word; FADE BY SUBTRACTION, never regenerate. TTS strictly after diacritize→verify.
- **Architecture: Arabic is the HARD tier** (RTL/bidi, clitic-aware tokenization, root-pattern morphology breakdown,
  diacritize→verify→TTS ordering, blend-grammaticality care) — closer to the baseline's "Japanese stress-test" than Spanish.

## Open decisions surfaced (pending user) — see `docs/research/arabic-validation.md` §9
Scope of "read anything" (formal-only vs dialect roadmap) · read-vs-write balance (revised rec: reading-first) ·
native-checker budget for judge calibration · vowel-toggle/fade-track granularity · numeral convention (rec: Eastern) ·
pausal vs full case endings early · CAMeL/CATT deployment topology.

## Locked round 2 (2026-06-21)
- **Scope: formal MSA only**; dialect + Arabizi acknowledged in onboarding, deferred (unscheduled).
- **Read/write: balanced** (both first-class in v1), BUT reading spine ships first so writing-correction rides a
  proven verification layer. Risk accepted: writing-correction is the hardest-to-verify surface.
- **Verification: automated-only v1** (tool consensus + dediac round-trip + CAMeL membership + diverse LLM jury).
  No paid native calibration. Mitigations: conservative gating (withhold-on-uncertainty); native calibration built
  as a drop-in (log low-confidence items, keep golden sets) for easy later addition.

## Architecture & UX vision (user directive, 2026-06-21)
- **Top-of-the-line UI.** The **main conversation drives**; the user has **tools to interact with / analyze** the
  conversation. Tools are LENSES on the conversation, not separate modes.
- **Separation of concerns / 3 tiers:**
  - **Presentation** (frontend, React/web): presentation + interaction only; talks only to orchestration via streaming (SSE).
  - **Orchestration layer** (separate service): the agentic loop + turn coordinator; owns the hot path; single contract to the frontend; fans out to backend services.
  - **Backend microservices on GCP** (Cloud Run, scale-to-zero for low cost): linguistics (segmentation+morphology) ·
    diacritize-verify · lexicon/gloss · tts · correction · learner-model (FSRS + word-state + the word list).
    Shared: Neon (state), Upstash (cache), R2/CDN (audio).
- **Microservice architecture** chosen for low cost (scale-to-zero) + composable I/O + polyglot boundaries (Python NLP vs TS orchestrator).
- **Granularity recommendation: HYBRID** — orchestrator + a small set of services grouped by runtime × change-rate ×
  scaling profile, in a MONOREPO with shared contracts + one Terraform tree. (Not full per-capability microservices; not a monolith.)
- **Hot-path latency guard:** orchestrator keeps synchronous service calls minimal + parallel; expensive/independent
  work (verification jury, TTS pre-gen, learner-model updates) runs async + cached, off the stream.
- **UX tools:** click-word card (meaning · root+pattern breakdown · audio · add-to-list) · word list/vocab tracker
  (= the per-word mastery state made visible; same data driving blend+fade+correction) · analyze (sentence breakdown) ·
  vowel toggle + humane "more/less English" & "more/less vowels" overrides · margin (glosses, grammar notes, corrections, encouragement).
- **Unification insight:** the word list IS the learner-model state made visible — a read-view on the one primitive
  (per-(user,lemma,sense) mastery) that everything else already depends on.

## UI/UX decisions — locked via visual companion (2026-06-21)
- **Layout: 3-column "reading desk"** — tool rail (left) · conversation (center) · margin (right). Everything visible at once.
- **Default token rendering: status-tint + inline vowel-fade** (the reading surface IS the progress display): Arabic words
  coloured by familiarity (new / learning / known), English greyed so the eye is pulled to the Arabic, AND vowels fade
  inline by mastery (new = full, learning = minimal, known = bare). A calm-down toggle reduces marking when it feels busy.
- **Click-a-word: hybrid** — compact popover at the word (meaning · audio · add-to-list) + "more →" expands the full
  breakdown into the margin. Card payload: word + transliteration + audio, contextual meaning, **root + pattern**
  (e.g. مَكْتَبَة = root ك-ت-ب + pattern مَفْعَلة "a place of" → "place of books"), POS/features, root family
  (كِتَاب book · كاتِب writer), add-to-list / know-it.
- **Vowel control: 3-step slider (Full · Minimal · Off)** as primary + hold-a-word-to-reveal + a hide-all self-test key.
  The automatic per-word fade runs underneath; the slider is the manual override (incl. a deliberate "minimal-marks-only" mode).
- **Writing input: NATIVE Arabic typing on the standard Arabic (101) layout**, via an on-screen **trainer keyboard** that
  labels each QWERTY key with the Arabic letter it produces — so the user learns the real layout, transferable to any keyboard.
  Labels FADE as muscle memory builds. Harakat on Shift; early on the agent can auto-vowel + verify the typed skeleton.
  Transliteration as a possible fallback (minor open detail). **VERIFY the layout mapping against the official Arabic-101 spec at build.**
- **Three fading scaffolds, one philosophy:** English recedes (vocabulary) · vowels recede (mastery) · keyboard labels recede
  (muscle memory). One coherent "training wheels come off" theme across the whole product.
- **Correction:** renders in the **margin** (never interrupts the conversation spine), categorized, **blend-aware**
  (English used as a fallback is never marked wrong), conservative (withhold-on-uncertainty).
- **Persona:** one named character (pinned). **Word list:** a tool-rail panel = the mastery state made visible.

## v2 VISION (2026-06-21) — supersedes the "reading desk" framing
The product is a **capable conversational AI AGENT**, not a document reader. Core additions:
- **Agent with tools:** the chatbot can do **web searches**, analyze **uploaded documents**, and hold open
  conversation. It is genuinely useful — AND the medium of every reply is the progressive English↔Arabic blend.
- **TWO progression axes (decoupled dials):**
  1. **Vocabulary** — Arabic words woven into English sentences; advances as the user **confirms** more words
     (more words render in Arabic over time).
  2. **Structure / grammar** — eventually the sentence **structure and rules** shift from English → Arabic
     (word order/VSO, agreement, definiteness, iḍāfa), independent of vocabulary.
- **Optional STRUCTURE-SWAP mode:** read **English words in Arabic structure** (grammar trainer) and
  **Arabic words in English structure** (vocab trainer). Vocabulary-language and structure-language are independent.
- **Progression is on the USER side** — driven by what they learn/confirm, not a global clock.
- **Learning-path service (later):** auto-determines where the user is on the path and sets the vocab + structure
  values automatically, with **custom user overrides**.
- **Carry over v1's validated elements** (clickable words → meaning/root-pattern/audio, vowel fade, status tints,
  margin notes/corrections, trainer keyboard, the warm-paper Arabic-first DESIGN.md system) — recontextualized
  inside a capable agent chat (conversation-first, with web-search + document-upload affordances).
- **Figma file:** `mFjP4XMgcvdwzloZL9EMze` (https://www.figma.com/design/mFjP4XMgcvdwzloZL9EMze), the project's Figma team drafts.
  Page **brainstorm-v1** = original reading-tutor screens (5); page **brainstorm-v2** = the corrected agent vision (6 screens, BUILT).
  Foundations (Colors/Scale variables + Type styles) are file-level, shared by both pages.
  v2 design plan + screen list: `docs/plans/v2-design-plan.md` (from the v2 design workflow).
  v2 screens: 01 Agent chat (web search) · 02 Doc upload + cited reply · 03 Two-axis progression · 04 Structure-swap · 05 Learning path · 06 Endpoint.

## Design-system inheritance (2026-06-29) — system-level rules, instances inherit
- **Decision (LOCKED):** make system-level design rules the single source and have each language instance **inherit**, overriding only its script-layer deltas. Replaces the hand-built-per-instance approach (which produced the Chinese Figma frames as hard-coded orphans — zero shared variables/components).
- **Mechanism:** a CORE published Figma library + per-language consumer files; a 3-tier variable model (Primitives → Semantic → `Locale`[ar|zh] modes); **value deltas** (font/numerals/leading) ride `Locale` modes, **structural deltas** (RTL/LTR direction, ḥarakāt-vs-pinyin-ruby annotation, glyph-keyboard-vs-pinyin-IME input) are components/variants/slots — never modes.
- **Machine SoT:** `tokens.json` (W3C DTCG) at repo root mirrors `DESIGN.md` §0; the Figma CORE library is the third mirror; reconcile all three same-PR (AGENTS.md Update-Triggers row added).
- **Add-language cost after migration:** +1 `Locale` mode (~5–8 deltas) + 0–3 leaf components + 1 consumer file + a direction decision; everything else inherited free.
- **Full architecture + migration + risks:** `docs/decisions/design-system-inheritance.md` (from the `design-system-inheritance-research` workflow, 6 research angles + synthesis).
- **Status:** ADR + `tokens.json` landed this PR; Figma CORE library variables (Primitives/Semantic/Locale[ar,zh]) building next; the component library + per-instance refactor are follow-ups.
- **Drift noted (separate cleanup):** `INSTANCE.md` / `motion-spec.md` / `user-stories.md` reference v3 + `brainstorm-v2` Figma pages that don't exist in the live file (only `brainstorm-v1` is present) — to reconcile.
