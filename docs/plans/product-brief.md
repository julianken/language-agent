# Product brief (initial concept) — language-agent

> Captured at the start of brainstorming, 2026-06-21. This is the *seed concept* in the
> user's words plus my read of it. It grounds the research sweep; it is **not** a settled
> design. Open questions are listed at the bottom — research informs them, the user decides.

## One-liner
A chatbot that helps a user learn another language through **reading and writing**, where the
conversation is augmented by (a) **marginalia** — notes/help "in the margin" alongside the chat —
and (b) **rich interactive responses**: the assistant's replies are clickable and correctable, not
flat text.

## Core experience (as described)
- **Chat** in/around the target language is the spine.
- **Writing in the margin** — a margin channel running alongside the main chat (glosses, hints,
  grammar notes, vocabulary, encouragement — exact contents TBD).
- **Interactive elements on responses:**
  - **Correction** of the user's input (their writing gets corrected with feedback).
  - **Click a word** in a response → meaning, translation, morphological/grammatical **breakdown**,
    and an **audio reading** (TTS), etc.
- All of this is produced inside an **agentic loop** (multi-step LLM agent with tools), not a single
  flat completion.

## Progression model — CORE REQUIREMENT (added 2026-06-21)
The experience is a **blend of English and the target language, starting English-heavy and gradually
integrating more target language over time** — a *fading-L1-scaffold* / "diglot-weave" progression.
Early on, most of the text is English with target-language words/phrases woven in; as the learner
advances, the target-language density rises until the learner is reading/writing mostly (eventually
all) in the target language. This is a first-class, persistent design axis — not a setting buried in
options. It implies: a tunable **blend ratio**, a rule for **what advances it** (time vs mastery), a
policy for **what to blend first** (high-frequency content words? whole phrases? grammar?), and a
guard against **incoherent mixed-language sentences** (grounded in the gradual-blend / diglot-method research).

## System shape (as described)
- An **agentic loop** generates the pedagogically-rich, interactive content.
- A **hosted server** packages everything into a **structured format** and feeds it to the frontend.
  The server is the thing that turns agent output into the clickable/correctable/audio-enabled
  payload the UI renders.
- **Terraform** provisions the infrastructure.
- Built on the **agentic-seed** template (`github.com/julianken/agentic-seed`) — which supplies the
  *agentic PR/review/merge process*, not an app stack.

## What agentic-seed gives us (confirmed from the repo)
- Process spine: `AGENTS.md` (conventions, review-before-merge, guardrails, doc-drift Update Triggers).
- `DESIGN.md` as the single design source-of-truth (token manifest → semantic → component).
- Optional **feature-pipeline** workflow engine (phases 0–11: brainstorm front-door → epic → issue
  fan-out → implement → review → merge) + a Node/Express **pipeline-dashboard**.
- Optional **review bot** identity + **Mergify** queue-merge + **Figma** read-only design module.
- It is a *fill-the-placeholders* template; the product stack is added to `AGENTS.md` once it exists.

## Open questions (for the user — research will frame options)
1. **Target language(s)** — which language first? (Hugely affects NLP: CJK segmentation, RTL, etc.)
2. **Learner level** — absolute beginner → advanced? CEFR band? (Drives comprehensible-input calibration.)
3. **Reading vs writing balance** — graded reading + lookups, or conversation + correction, or both equally?
4. **Audio scope** — per-word TTS only, sentence/passage TTS, and/or speaking practice (ASR/pronunciation)?
5. **Platform** — web first? mobile? PWA?
6. **Tutor persona** — neutral tool, or a character with personality/consistency?
7. **Latency posture** — how much agentic multi-step depth can we afford before interactivity suffers?
8. **Scope/ambition** — personal project MVP, or productized? (Sets the bar for infra/cost/SRS depth.)
9. **Personalization/memory** — does it track known words, learner model, spaced repetition over time?

## Research sweep domains (distilled into `docs/research/`)
Pedagogy/SLA · reading-app teardowns · chatbot-tutor teardowns · agentic-loop architecture ·
structured/interactive-content protocol · NLP (segmentation/lemmatization/furigana) · translation &
dictionary data · TTS/audio · grammar & writing correction (GEC) · spaced repetition & learner model ·
interactive-text frontend rendering · infra/Terraform/hosting. Synthesis docs at tmp/ root.
