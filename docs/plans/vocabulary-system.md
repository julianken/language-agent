# language-agent — The Vocabulary System (Q1–Q5)

> **Status: research synthesis → decision input for the v3 brainstorm.**
> Synthesizes 10 research perspectives + 4 generation-architecture proposals against the locked
> v1 spec (`50-v1-design-spec.md`), the v2 plan (`70-v2-design-plan.md`), and the Arabic validation
> (`23-arabic-plan.md`). This is the doc that fills the gap the operator named: *"the vocabulary
> system is conceptually underspecified."* It defines, in plain language and then in concrete rules,
> how a word gets learned, how words get chosen, how the right Arabic ends up in a reply, what the
> seed vocabulary is, and how new words appear while the learner is working — all keyed to the one
> load-bearing primitive (`word_state`) the rest of the product already depends on.

---

## 1. The conceptual model — how vocabulary works in this product, end to end

The product teaches reading via a **progressive English↔Arabic blend**, and the engine of that blend
is a single per-`(user, lemma, sense)` `word_state` row. Everything below is that one primitive,
viewed from five angles. The model has five moving parts and one governing constraint.

**(a) The unit is the LEMMA, not the wordform, not the root.** Arabic is type-rich: an Arabic
corpus has ~76% more surface types than the parallel English one, and clitic attachment alone
(`ال` the, `و` and, `بـ/كـ/لـ` prepositions, future `سـ`, pronoun suffixes) inflates vocabulary
size ~24.5% (Alotaiby & Foda). If `word_state` keyed on surface forms, it would explode. So the
counting unit is the **CAMeL lemma id** after clitic+inflection stripping: mastering `كتب` (kataba)
once credits all its conjugations. The root (`ك-ت-ب`) is *not* the unit — root-level merging is
high-recall/low-precision (it over-merges `كتب` write, `كتيبة` battalion, `مكتب` office), so a root
gives only a **weak derivational prior** (a head-start for siblings, never auto-credit). This lemma
choice is also the lever that makes the coverage math tractable (see the constraint below).

**(b) Acquisition is a two-layer lifecycle, not a single ladder.** A word lives in two states at
once. A **discrete status ladder** — the v1 `new → learning → familiar → known` ladder, extended
with an explicit *productive* sub-state — drives **blend eligibility** and **vowel fade** (which
tint, whether it may render Arabic, how many ḥarakāt). A **continuous FSRS state** (Difficulty,
Stability, Retrievability) drives **scheduling** and **breathe-down**. These are orthogonal: a word
can be `known` (eligible to render bare) yet have low Retrievability (due for a review). The v1 spec
already derives the discrete status *from* FSRS (`S>30d & R>0.9 ⇒ known`); we keep that and add the
receptive/productive split, because recognition precedes and persistently outpaces production
(Webb 2008) — seeing/clicking a word in the blend is **receptive evidence only** and must never
auto-promote it to *production* mastery (which the structure axis already, correctly, gates on
production).

**(c) Acquisition is incremental and needs many spaced encounters.** A word is not learned in one
exposure. The SLA literature converges on ~**8–12 meaningful, spaced encounters** for robust
incidental acquisition (Horst/Cobb/Meara; Webb; Pellicer-Sánchez & Schmitt), ~15–20 for durable
long-term memory. This sizes the ladder: a word's first Arabic appearance is *encounter 1 of ~10*,
not a "learned" event. Critically, **in-blend re-appearances and FSRS card reviews feed ONE
schedule** — a blend appearance is a low-stakes retrieval, weighted below a forced recall, and the
conversation itself *is* the review session.

**(d) Selection is frequency-as-skeleton, topic-as-sequencer.** Which Arabic words exist for a
learner to meet is governed by a precomputed curriculum (frequency-ordered, difficulty-gated,
content-word-first). Which word gets introduced *next* is governed by the current conversation
topic, constrained to stay inside the learner's comprehensible frontier. Frequency sets the floor
and eligibility; topic picks the sequence and earns free re-encounters (narrow reading).

**(e) Generation runs the safe direction: generate verified MSA, then anglicize DOWN.** The agent
does **not** write English and swap Arabic in. It generates a full, verified, fully-vocalized MSA
answer (the model commits to an intended lemma+sense, which the verifier needs as a target), then
**subtracts** — anglicizing back to English any word above the learner's level or that would breach
the coverage floor, and fading vowels per status. Anglicizing can never manufacture wrong Arabic;
the worst case is "too much English," which is explicitly never marked wrong. This is the v1
generate→verify→anglicize pipeline, and it is the architectural answer to the never-show-wrong
constraint.

**The governing constraint: the coverage floor.** Every reply must stay ≥~95% comprehensible
(`unknownTokenShare ≤ 0.05` over content tokens, v1 §3). This is the empirical *minimum* for
assisted comprehension (Hu & Nation 2000; Laufer & Ravenhorst-Kalovski 2010), and we have the
assistance the studies forbade (click-to-peek cards + English fallback), so we can sit near it
safely. The floor is what couples the two dials, sizes the new-word budget, and gates every
introduction. It is the constraint; the blend level is the freedom within it.

The thing the operator felt was missing is this: **the blend ratio is not a setting — it is the
emergent sum of per-word `word_state` decisions, capped by the coverage floor, aimed by a frequency
curriculum, sequenced by the conversation topic, and rendered by subtraction from verified MSA.**

---

## 2. Direct answers to the five questions

### Q1 — ACQUISITION: how a word is added and how its state advances

A word enters `word_state` at status `new` the first time the verified blend renders it in Arabic,
or via a cold-start calibration tap (tapped-"yes" seeds it at `learning`/recognized with a wide
confidence band — never `known`, because recognition ≠ production). It then advances along the
extended v1 ladder, gated by encounter counts behind a noise-absorbing estimator:

| Transition | Requirement |
|---|---|
| `new → learning` | ~2–4 successful spaced re-encounters (or one explicit "I know this" confirm) |
| `learning → familiar/known` | ~8–12 cumulative spaced successful encounters **and** a successful FSRS recall after stability > ~7 days |
| `→ mastered` | sustained **bare-vowel** recognition across ~15–20 spaced exposures with R staying high |
| **productive** sub-state | advances **only** on correct *unprompted production* (writing) — never on reading |

**Signals, trust-ranked** (highest → lowest), mapped to FSRS ratings (this is the v1 ranking, kept):

1. **Correct unprompted production** in the trainer → FSRS `Easy`; advances the *productive* sub-state (strongest).
2. **Explicit "I know this"** confirm → `Good`/`Easy`; jumps receptive status (LingQ-style checkmark).
3. **Successful FSRS recall** on a due word (R was low, recalled) → strong receptive.
4. **"Correct twice in a session"** auto-increment (LingQ rule) → moderate.
5. **Passive read, no click** → *weak* positive (counts toward the ~8–12 tally, **weighted low**: English fallback means a skipped Arabic word may not have been read at all — LingQ's "paging marks blue known" is too strong for a blend).
6. **Word-click / hover lookup** → **NEGATIVE**: a soft "I didn't know this." Breathes the word **down**, vowels re-appear, the word can drop back to English.

Promotion should require a **BKT-style P(known) ≥ threshold** over the signal history, not a single
event, so one lucky click never instantly promotes and one slip never demotes. **Breathe-down has
two distinct triggers, both logged** (`movedReason`): FSRS R-decay (a gentle "let's re-warm,"
never punishing) and an active click/lookup (immediate within-session demote). Counting cap:
**at most 1 exposure per lemma per reply** (so a long reply doesn't inflate the encounter tally).

### Q2 — SELECTION: which Arabic words, in what order

**Order = a single precomputed `curriculum_rank` per (lemma, sense)**, built from:
- **Frequency spine** — Buckwalter & Parkinson *A Frequency Dictionary of Arabic* (5,000 MSA lemmas, balanced 30M-word corpus, glosses + genre/dialect flags + root index).
- **POS-conditioned to CONTENT words** — function words/clitics (`و`, `في`, `من`, `ال`…) dominate the Zipf head but make poor clickable cards; they are **deferred to the structure axis**, arriving tied to grammar rungs (`ال` with S2 definiteness, prepositions with phrase rungs), not the vocab axis.
- **Difficulty gate** — SAMER Readability Lexicon (40k lemmas, L1–L5, CAMeL-aligned); drop L4/L5 early.
- **Imageability boost** — concrete/imageable content words first (dual-coding; "Early Acquired Words Are Both Frequent and Highly Imageable," MIT Open Mind 2024); Claude-scored or via English concreteness norms through the gloss.
- **Root-family productivity** (Aralex root/pattern frequencies) as a **secondary** re-rank — admit high-yield-root siblings of already-known roots. This is Arabic's morphology turned into the curriculum's compounding engine, and it recovers the coverage-per-word that Arabic's flat frequency curve loses.

**Runtime = a per-turn priority cascade** (not a toggle): (1) FSRS-due **reviews** first (free, not "new"); (2) **topic-relevant** new word that is *also* within the learner's next frequency band; (3) next `curriculum_rank` word as fallback. **Topic governs WHICH/WHEN; frequency governs ELIGIBILITY** — they conflict only when a topic word is rare, in which case it appears as a one-off glossed *transient* excluded from the spaced curriculum until it recurs.

The Arabic flat-curve fact sizes the ambition: Arabic needs ~**9,000 lemmas for 95% / ~14,000 for
98%** coverage (Masrai) vs English's ~4,000/8,000 (Nation) — counted on root/pattern-collapsed
lemmas, this is tractable, but it confirms the curriculum is a long road and the English scaffolding
(not curriculum size) is what holds the floor early.

### Q3 — GENERATION ARCHITECTURE: getting the right target words into the reply

**Recommendation: Prompt-Steer + Verified-Blend as the v1/v2 spine** — generate full verified MSA
(prompt-steered toward the known-list + new-word budget, a *soft* aimer), then verify, then
**anglicize DOWN by subtraction** to the learner's level. The hard guarantees (never-show-wrong,
coverage floor) live in the deterministic post-pass, **not** in the prompt. Add **oversample-and-rank**
(generate 3–5 candidates, score each with the CAMeL analyzer for in-budget coverage + due-review
coverage + new-word count, keep the best) to tighten adherence with no training and no logit access.
The other three architectures are rejected as the *primary* mechanism (see §3). This is decided by
the closed-API + never-show-wrong constraints, not by preference.

### Q4 — VOCABULARY BUILDER: bootstrap list, ordering, per-user seed

**One precomputed per-(lemma, sense) table keyed on CAMeL lemma id**, joined from license-clean
sources, in **four tiers**:
- **Tier 0 (~30 "freebies")** — loanwords-into-Arabic + Arabic-Indic numerals (`تلفزيون`, `بنك`, `فيلم`, `إنترنت`, `قهوة`…). Used **as the cold-start calibration tap set** because they are recognizable to an English speaker and give an instant win against an otherwise-empty calibration. (There is **no usable English↔Arabic cognate shortcut** otherwise — the "Arabic words in English" are unrecognizable loan *sources*.)
- **Tier 1 (~100)** — high-imageability A1 content words (Soliman & Familiar 2024 CEFR Arabic Vocabulary Profile A1 ∩ top frequency) in ~6 survival themes (greetings/people, family, food/drink, home, time, common actions). Thematic, not pure-frequency, so a beginner can hold a real micro-conversation.
- **Tier 2 (100→500)** — frequency spine re-ranked by concreteness + root-family + SAMER difficulty gate.
- **Tier 3 (500→1000)** — toward AVP-A2; function words deferred to the structure axis.

**Per-user seeding:** the 4-tap cold-start calibration ("recognize any of these?") samples Tier 0 +
high-imageability Tier 1, shown with full ḥarakāt + audio. A "yes" seeds that lemma into `learning`
(recognized) with a wide confidence band, shown honestly as a **fuzzy dot** until hundreds of
signals accrue; the default prior is frequency/CEFR-A1. The builder stays **small early** because
the 95% floor is met by English scaffolding, not by builder size.

Source join (all on CAMeL lemma id): **Buckwalter–Parkinson** (frequency rank + root index),
**SAMER** (L1–L5 difficulty, free, CAMeL-aligned), **KELLY Arabic** (CC BY-NC-SA, per-lemma CEFR
A1–C2), **Soliman & Familiar AVP** (curated A1/A2), **Aralex** (root/pattern frequency). Each entry
also carries a **pre-verified canonical diacritized form** so the verifier has a target and known
words hit GREEN cheaply.

### Q5 — NEW-WORD INTRODUCTION: do new words appear while working?

**Yes — throttled hard, governed by a per-turn budget, frequency-curriculum-led, topic-sequenced.**

- **Budget = `floor(assistantTurnTokens / 50)`** (Nation's ~2-new-per-100 / 1-in-50 graded-reader ratio), hard-capped so predicted `unknownTokenShare ≤ 0.05` (default target 0.02–0.03). Short chat turn ⇒ **0–1** new words; long researched turn ⇒ **2–3**; absolute cap **~2/turn** for a beginner, **~5–10/session** (Nation's sustainable deliberate-load).
- **Fill order:** FSRS-due reviews (as prose) → topic-relevant new word in the next frequency band → next curriculum word. On turns where reviews + topic consume the budget, **zero new words is correct**.
- **First encounter is scaffolded:** full ḥarakāt + gold "new" wash + auto-gloss + audio on the first 1–2 appearances; it does **not** consume a "learned" slot or enter FSRS as a real review until the learner engages.
- **Working-memory cap across both axes:** total novel items (new vocab + any new structure note) ≤ ~3 per turn, never two novelties in one clause — implement as **one shared novelty budget** with the structure axis (this *is* the v2 §2.3 comprehension governor).
- **Struggle hold:** ≥2 distinct word-clicks in a turn, or coverage near the floor, sets next-turn budget to 0 and enters the v2 "stretching" state until a clean turn.
- **Cold start (<~100 signals):** pure frequency curriculum, 1 new word/turn max; enable topic-priority only once the learner has enough confirmed words that topic candidates reliably fall inside i+1.

---

## 3. The generation-architecture decision (the crux)

Four architectures were assessed against the two binding constraints: **(i) Claude is a closed API**
(no `logit_bias`, no constrained-decoding/GBNF hook), and **(ii) never-show-wrong-Arabic** (a wrong
diacritic is a different real word, and neither learner nor operator can read Arabic to catch it).

| Architecture | What it is | Verdict |
|---|---|---|
| **A. Prompt-Steer + Verified-Blend** | Prompt Claude with the known-list + new-word budget; generate full MSA; verify; anglicize DOWN by subtraction | **ADOPT (spine)** — only as the *soft aimer*; guarantee lives in Stage B |
| **B. Fine-tune a graded-MSA generator** | LoRA/SFT an open model to natively prefer the leveled lexicon | **DEFER (flagged optimization)** — cannot reach 0% diacritic error; premature until a self-distillation corpus exists |
| **C. Generate-then-Substitute** ("replace close words") | Write English, swap content words for Arabic | **REJECT (literal)** — inverts the pipeline into its unsafe direction; harvest its *theory* only |
| **D. Constrained-Decode** | Logit-mask an open model to emit only allowed lemmas | **DEFER (controllability layer)** — requires self-hosting; guarantees *which* tokens, never correct *diacritics* |

**Why A is the spine.** Prompt-steering is a documented *weak, drifting* controller (CEFR
ControlError ~0.28–0.39; lexical difficulty measurably *rises* across chat turns even with a constant
system prompt — the alignment-drift finding, which matters because our product *is* a chat). But it
does not need to be accurate: the never-show-wrong and coverage-floor guarantees are enforced
deterministically in Stage B by the CAMeL-membership check + 2nd diacritizer + refutation jury +
anglicize-by-subtraction. **Prompt drift degrades quality, never safety** — the worst a drifted
prompt can do is produce a reply that gets anglicized more heavily ("too much English"), which is
never wrong. Generate-Arabic-first is also the SLA-safest direction: the model commits to an intended
lemma+sense (giving the verifier a target), and every new word arrives in fully-grammatical,
naturally-occurring context — exactly what the 8–12-encounters literature requires.

**Why C is rejected.** Literal generate-English-then-swap-Arabic-in has *no committed sense* at swap
time, so the CAMeL membership oracle has nothing to verify against — it revives the exact
word-sense ambiguity (wrong sense = wrong real word) the whole engine exists to kill. Three
perspectives independently flag this. The only safe variant (substitute against *pre-verified*
lemmas + re-inflect through CAMeL) is functionally the anglicize-down engine running *forwards*, but
with extra agreement/inflection error surface and a worse topic-driven-new-word story. **The blend
engine is already a substitution engine running in the safe direction; name it as one and stop
treating C as a path to build.** Its genuine contribution is *theory*: the Matrix Language Frame /
Equivalence Constraint / Free-Morpheme constraints are the formal rule for *which slots may carry an
Arabic island* (content words only, never glue `ال` onto an English stem) — this upgrades the v2
Mode-A discipline from intuition to linguistics.

**Why B and D are deferred, not adopted.** Both require self-hosting an open-weights Arabic model (B
for the tuned generator, D for logit access) — a major architecture change. Neither can satisfy the
hard constraint: tuning only shifts probability mass (never to 0% error), and masking guarantees
*which tokens* appear, never that their *diacritics* are correct. The full CAMeL verifier stays
load-bearing in every architecture. B's real win is cost/latency (CALM/Tarzan-to-Tolkien: SFT on
~2k examples matched GPT-4 CEFR control at ~20× fewer tokens) — reach for it *later*, via
self-distillation from the verifier's own GREEN-gated outputs, once that corpus exists. D's real win
is **drift-proof per-turn adherence** to the allowed-lemma set — reach for it *if and only if*
measured Claude drift breaches the coverage floor at higher blend levels (V3+).

### The recommended hybrid, specifically

**v1/v2 ship Architecture A:**
1. **Stage A — Research & Compose (Claude, prompt-steered, soft).** Receives the user message +
   evidence + the steering seed (working-set known-list, due-review list, ≤1–2 new-word candidates,
   coverage-floor instruction, MLF content-word-slot rule, `structureStage`). Emits full vocalized
   MSA with interleaved citations. **Oversample-and-rank N=3–5** candidates (parallelized), score
   with CAMeL against the budget, keep the best.
2. **Stage B — Verify, Blend, Structure-shift (deterministic, the v1 engine).** Per Arabic token:
   dediac round-trip · CAMeL membership against the *intended* lemma+sense · independent 2nd
   diacritizer (CATT/Sadeed, different family) · diverse refutation jury → GREEN/YELLOW/RED. Then
   anglicize DOWN any RED / above-level / floor-breaching token; vowel-fade per status. Known words
   carry **pre-verified** forms and skip re-verification — only new/changed Arabic incurs jury cost.
3. **Re-inject the seed every turn** and **monitor per-turn `unknownTokenShare` as a drift alarm.**

**What would change the call:**
- If measured **generation waste at V0–V1** is severe (e.g. <10% of generated Arabic survives to the surface — an open measurement), a leaner constrained/prompt-only front-end becomes attractive to stop burning tokens on Arabic nobody sees.
- If measured **Claude per-turn lexical drift** breaches the floor at higher blend levels, add Architecture **D** (self-hosted open Arabic realizer + XGrammar masking over CAMeL lemma ids), keeping the verifier in place.
- If **generator cost/latency** becomes the bottleneck and a large GREEN-gated corpus exists, add Architecture **B** (LoRA self-distillation) as a swappable Stage-A component behind the unchanged gate.

---

## 4. The vocabulary builder & seed plan (concrete)

**Master table** — one row per `(lemma, sense)`, keyed on CAMeL lemma id, columns:
`{ curriculum_rank, freq_rank, cefr_band, samer_level, imageability, root, pattern, theme, pos,
is_loanword, canonical_verified_diacritization, gloss }`.

**Build steps:**
1. Take **Buckwalter–Parkinson** top ~2,000 as the frequency spine (rank + root index).
2. Reconcile every lemma to a **CAMeL lemma id** (the shared key for curriculum, generator seed, substitution lookup, and verifier — no drift between the frequency DB and the verifier's lemma inventory). Apply **clitic tokenization** (LDC/ATB scheme) so counts are at lemma, not surface, granularity.
3. Tag with **SAMER** level (L1–L5), **KELLY** CEFR band (A1–C2), **Aralex** root/pattern frequency.
4. POS-condition: mark function words `defer-to-structure-axis`.
5. Imageability score (Claude-scored or English-norm proxy via gloss); boost concrete content words.
6. For the literal first ~100–300, prefer the **Soliman & Familiar AVP-A1/A2** curated set over the raw frequency head.
7. Pre-verify the canonical diacritized form of every Tier 0–2 lemma offline through the full GREEN gate.

**Ordering = the four tiers** of §2 Q4 (Tier 0 freebies → Tier 1 ~100 thematic A1 → Tier 2
500 frequency-spine re-ranked → Tier 3 1000 toward AVP-A2).

**Per-user seed:** cold-start 4-tap calibration over Tier 0 + high-imageability Tier 1; "yes" →
`learning` with a fuzzy-dot confidence band; default frequency/CEFR-A1 prior.

**Licensing note (decision for §7):** SAMER is research/eval-gated, KELLY is CC BY-NC-SA, B&P is a
copyrighted book. All fine for a *personal* tool. A future commercial version needs a cleanroom
frequency list re-derived from **Leipzig Corpora Collection** / **arTenTen** (Sketch Engine), which
are more permissively licensed.

---

## 5. The new-word introduction policy (concrete runtime rules)

```
per assistant turn:
  budget B = floor(assistantTurnTokens / 50)                 # Nation 1-in-50
  B = min(B, maxNewForCoverage(knownSet, plannedTokens))     # keep unknownTokenShare ≤ 0.05
  if struggleHold (≥2 clicks last turn OR coverage near floor): B = 0
  if coldStart (<~100 signals): B = min(B, 1)

  candidates = []
  candidates += FSRS_due_reviews renderable on this topic     # FREE — reviews, not "new"
  candidates += topic_relevant_new_lemmas ∩ next_frequency_band   # topic = WHICH/WHEN
  candidates += next_curriculum_rank_lemma                    # fallback only

  newWords = take(candidates_that_are_new, B)
  noveltyBudget shared with structure axis: (newWords + newStructureNote) ≤ 3, never 2 in one clause
  hand seed to Stage A: prefer knownSet, weave due reviews, introduce ≤ newWords in context-supported slots
```

**Topic vs curriculum reconciliation:** topic and frequency *agree by construction* — a topic word
is only eligible if it also falls in the learner's next frequency band. A genuinely topic-needed but
rare word (a proper noun, a technical term from a web search) is shown as a **transient**: glossed,
rendered in Arabic only if already pre-verified (else English), and **excluded from the spaced
curriculum and the coverage estimate** until it recurs. So a one-off rare word never pollutes the
frequency-coverage dial.

**FSRS interleave:** each turn `path-svc` hands Stage A a **due-list** (lemmas with R below the
desirable-difficulty target ~0.8 that are renderable on this topic). The reply prefers those lemmas;
**used + not-clicked = successful recall (`Good`)**, **clicked = lapse (`Again`, breathe-down)**. The
conversation is the review session — no separate review mode. Open: whether to target R≈0.9
(retention-optimal) or ~0.8 (desirable-difficulty, learning-optimal) — an A/B or per-user setting.

---

## 6. Arabic-specific gotchas & the tooling / eval stack

### Arabic gotchas (lemma / root / sense / diglossia / morphology)
- **Lemma is the counting unit; root is only a weak prior.** Root-merge over-credits (`كتب`/`كتيبة`/`مكتب`). Full transfer across a lemma's inflections; head-start (never auto-credit) to root-siblings.
- **Sense comes from the generator, not morphology.** CAMeL returns ranked analyses but "does not fully disambiguate sense." The `(lemma, sense)` key's sense field is **stamped by the agent's intended sense at generation time** (which the verified-blend already requires). Polysemous lemmas carry independent per-sense states (knowing `كتاب`=book gives zero credit for a rarer sense).
- **Clitics inflate everything ~24.5%** — tokenize at the lemma level (LDC/ATB clitic split) before counting or scheduling.
- **Diglossia / MSA-only.** B&P frequencies blend written+spoken+dialect; an MSA-reading-only product may want a written-MSA-re-ranked list (Leipzig/arTenTen) to avoid teaching spoken-frequent-but-written-rare items early. Onboarding must say honestly that reading MSA ≠ understanding spoken dialect.
- **Function words ≠ vocab axis.** The Zipf head is function words/clitics — defer them to the structure axis (`ال` with definiteness, prepositions with phrases), not the clickable-card vocab axis.
- **iʿrāb (case endings) are the shared "last wall"** — both the S5 structure rule and the last vowels the fade strips; keep on one track so the axes don't fight the final vowel (validated in `23-arabic-plan.md`).

### Tooling stack (named)
- **Morphology / lemmatization / verification spine:** **CAMeL Tools** (`calima-msa-r13` / Camel Morph MSA, 100k+ lemmas) — the membership oracle (*"is the chosen diacritized form a member of the analysis set for the INTENDED lemma+sense?"*) and the lemmatizer that maps any surface form to the lemma counting-unit. Camelira (BERT) for disambiguating *user* text.
- **Diacritizer ensemble:** Claude (primary) + an independent 2nd from a *different* family — **CATT** or **Sadeed-1.5B** — plus a dediac round-trip. Cross-family consensus, not one model twice.
- **Frequency / selection:** Buckwalter–Parkinson (spine), SAMER (difficulty), KELLY (CEFR), Soliman & Familiar AVP (curated A1/A2), Aralex (root/pattern), Leipzig/arTenTen (cleanroom backup).
- **Glosses:** Kaikki/Wiktionary Arabic dump + Buckwalter glosses + back-translation-verified Claude gloss as primary; Arabic WordNet/LughaNet/AWN V3 for **sense inventories / root families only** (too sparse for primary glosses).
- **Embeddings (recall only):** AraVec / fastText for topic-relevant candidate *recall*; AraBERT/CAMeLBERT for contextual fit — **propose, never decide**; every candidate gated through CAMeL/jury.
- **TTS:** feed the already-verified vocalized string to **Azure** Arabic neural voices (hosted, easiest first) or **MMS-TTS-Ara / ArTST** (open). Never synthesize from an unverified form. Audio is the one place dialect could later vary without touching the verified-blend engine.

### Evaluation when no one can read Arabic
The load-bearing gate is **deterministic and bias-free**: CAMeL set-membership of the chosen
diacritization in the intended lemma+sense — pass/fail, not a judgment, trustable by a non-Arabic
reader. Everything else corroborates:
- **Frozen golden-set DER/WER regression** — WikiNews-2014, WikiNews-2024 (multi-reference), SadeedDiac-25 — run on every diacritizer change. **Reproduce the cited ~1.39 DER in-repo**; do not trust it from memory.
- **dediac round-trip** self-consistency (strip → re-diacritize → compare).
- **Diverse multi-family refutation jury** — can only *downgrade* GREEN→YELLOW, never substitute for the deterministic gate. Diversity is mandatory: the multilingual-LLM-judge literature shows single English-trained judges carry **translationese bias** and don't transfer to Arabic; judge on back-translation + cited evidence, not on fluency.
- **Back-translation** semantic checks for glosses/answers.
- **Structured low-confidence logging** so paid native-speaker calibration is a drop-in later (the locked v1 decision).
- For word-*choice* quality specifically: score each reply's lexicon with the CAMeL analyzer against the budget (in-budget coverage %, due-review hit rate, new-word count) — this is the same signal that powers oversample-and-rank, so eval and runtime share one metric.

---

## 7. Open DECISIONS for the v3 brainstorm

Framed as choices the operator must make (not musings):

1. **Coverage policy — one number or two?** Recommend **two**: default each reply to ~97–98% known-word coverage (the unassisted-reading target) and treat 95% as the explicit hard floor for deliberate "stretch" turns. The v2 governor is at 95%; decide whether 98% becomes the default with 95% as the named stretch state.

2. **Learnable unit for coverage math — surface lemma or root/pattern-collapsed family?** Masrai's 14k-for-98% is lemma-dependent; a root/pattern unit cuts it dramatically but risks over-crediting. Recommend **lemma as the counting unit, root as a weak prior** — but confirm against a small CAMeL pilot before baking it in.

3. **Receptive vs productive — does reading-first ever *require* production to reach top mastery?** Recommend tracking productive separately and **not** gating the reading north star on it (sustained bare-vowel recognition suffices for reading); production is an optional, separately-tracked ratchet. Confirm.

4. **New-word introduction driver at cold start vs warm — and the transient-word rule.** Confirm: frequency-curriculum-led until ~100 signals, then topic-priority; rare topic words enter as glossed transients excluded from the curriculum until recurrence.

5. **FSRS review target retrievability — R≈0.9 (don't-forget) or ~0.8 (learn-faster)?** These trade off; decide a default (recommend ~0.8 for in-conversation reviews) or expose as a per-user pace setting.

6. **Generation architecture commitment for v1 — confirm A (prompt-steer + verified-blend + oversample-and-rank), defer B/D.** And set the two trip-wires that would change the call: the V0–V1 *generation-waste* measurement (is generate-then-anglicize burning tokens?) and the per-turn *drift* measurement (does Claude breach the floor at V3+?).

7. **Seed-list licensing path.** Personal tool: use SAMER/KELLY/B&P directly. If a commercial version is ever in scope, commit to a cleanroom Leipzig/arTenTen-derived frequency list now so the curriculum doesn't have to be rebuilt later.

8. **Register spine for the frequency list.** B&P is balanced/pan-Arab; a useful *conversational* agent (news/everyday/technical) may diverge from it. Decide whether to recompute a target-register frequency list (Sketch Engine/arTenTen) or accept B&P's balance for v1.

---

## 8. LOCKED — vocabulary-system decisions (brainstorm, 2026-06-21)

All eight decisions resolved. These are now the spine of v3.

| # | Decision | LOCKED choice |
|---|---|---|
| 1 | Generation architecture | **Prompt-Steer + Verified-Blend + oversample-and-rank (N=3–5).** Generate full verified MSA → anglicize DOWN by subtraction; the never-show-wrong + coverage guarantees live in the deterministic Stage B, never the prompt. **Defer** constrained-decode (D) and fine-tune (B) behind two trip-wires: (a) measured V0–V1 *generation-waste*, (b) measured per-turn *drift* breaching the floor at V3+. |
| 2 | Counting unit | **CAMeL lemma id.** Root = a *weak derivational prior* (head-start to siblings, never auto-credit). Sense is stamped by the generator → per-`(user, lemma, sense)` state. |
| 3 | Coverage policy | **Two numbers: ~98% default per-reply target (unassisted-reading), 95% named hard floor for deliberate "stretch" turns.** This couples the two dials and sizes the new-word budget. |
| 4 | Receptive vs productive | **Split states; reading north-star gated on sustained bare-vowel RECOGNITION only.** Production is a separately-tracked optional ratchet — writing advances its own track but reading mastery never waits on it. |
| 5 | FSRS review target | **R ≈ 0.8 (desirable difficulty)** for in-conversation reviews. Not exposed as a per-user setting in v1. |
| 6 | New-word driver | **Frequency-curriculum-led at cold start (<~100 signals, ≤1 new/turn) → topic-priority once warm** (topic picks the next word *within* the learner's next frequency band). Rare topic words = glossed **transients**, excluded from the curriculum + coverage estimate until they recur. Budget `= floor(turn_tokens / 50)`, cap ~2/turn (beginner) / ~5–10/session; **one shared novelty budget with the structure axis** (≤3 novel items/turn, never 2 in a clause); struggle-hold → 0. |
| 7 | Register | **Target the balanced-MSA register** (Buckwalter–Parkinson methodology), not a recomputed news/conversational register, for v1. |
| 8 | Sourcing / licensing | **BUILD CLEANROOM FROM THE START** (operator's call — more future-proof than the recommended "use gated lists now"). |

**Reconciling #7 + #8 (the only non-obvious interaction):** the v1 spine is a **cleanroom frequency list, balanced-MSA register, keyed on CAMeL lemma id**, derived from permissively-licensed corpora (**Leipzig Corpora Collection / arTenTen via Sketch Engine**). Buckwalter–Parkinson / SAMER / KELLY / AVP are used **only as offline validation benchmarks** (compare our ranking + coverage curves), never redistributed in the product. Consequence: the **frequency spine** is cleanly derivable, but the **difficulty + CEFR layers** become cleanroom-derived too — frequency rank + word length + morphological complexity heuristics + an **LLM-scored CEFR/difficulty estimate**, validated offline against SAMER/KELLY. The small **Tier-0 loanword "freebies"** and **Tier-1 ~100 thematic-A1** sets stay hand-curated (small enough to author cleanly). CAMeL Tools (Apache-2.0) stays the morphology/verification spine regardless.

**The locked system, in one paragraph.** The blend ratio is the emergent sum of per-`(user, lemma, sense)` `word_state` decisions, capped by a two-number coverage policy (**98% default / 95% stretch**), aimed by a **cleanroom, balanced-MSA frequency curriculum** (CAMeL-lemma-keyed), sequenced by the conversation topic within the learner's frequency frontier, and rendered by **Prompt-Steer + Verified-Blend** (generate verified MSA → anglicize down by subtraction). Words advance through a two-layer lifecycle — a discrete `new→learning→known→mastered` status ladder (blend eligibility + vowel fade) alongside continuous **FSRS @ R≈0.8** (scheduling + breathe-down) — over ~8–12 spaced encounters, gated by a **BKT-style P(known) threshold** so no single click promotes or demotes. Reading mastery needs recognition; production is tracked separately. New words appear while working, hard-throttled by a per-turn budget, with FSRS-due reviews woven into the prose as the (flashcard-free) review session.

**New v3 work this implies (beyond the existing pages):**
- A **vocabulary-builder / curriculum service** (offline): build the cleanroom CAMeL-lemma-keyed master table (freq spine + cleanroom difficulty/CEFR + imageability + root/pattern + pre-verified canonical diacritization + tiers).
- A **learning-path / selection service** (runtime): the per-turn priority cascade (due reviews → topic-in-band new word → curriculum fallback), the shared novelty budget, the transient-word rule.
- The **oversample-and-rank** stage in the cite-then-blend pipeline (generate 3–5, CAMeL-score against the budget, keep the best).
- **Drift + generation-waste instrumentation** (the two trip-wires) as first-class metrics.
- A **word_state schema** carrying the discrete ladder + FSRS state + receptive/productive split + BKT P(known) + curriculum_rank.
