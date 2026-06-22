# 23 — Arabic Plan: Decision-Ready Synthesis

The product (`language-agent`) is a chat tutor that teaches a complete beginner to **read** (and write) a language from scratch by blending English with the target, with a margin channel, click-any-word lookup (meaning + grammar breakdown + TTS audio), and writing correction — all driven by an agentic LLM loop and one per-(user, word, sense) mastery state. **Locked: target = Modern Standard Arabic (MSA); learner = zero-Arabic English L1; one persona; reading is the north star.** The **vowel mechanic** is central: default = fully vocalized; a global on/off toggle; per-word fade (full → partial → none) driven by the same mastery state as the English→Arabic blend. **Critical constraint: neither the user nor the operator can read Arabic, so every Arabic byte — especially diacritization — must pass an LLM-judge + deterministic cross-check before it is shown.**

This file merges three independent adversarial judge verdicts (Arabic linguistics; teaching-Arabic-as-foreign-language; adversarial fact-checker) with three research briefs (14-diacritization, 15-nlp-script, 16-verification-judges), and computes the architecture deltas from the Spanish baseline in `20-SYNTHESIS-architecture.md`.

---

## 1. Claim verdicts (consensus across all 3 judges)

The user advanced four claims (C1–C4). Below: the consensus verdict, the corrected picture in plain English, where the judges disagreed, and confidence.

### C1 — "Written (Standard) Arabic is the same across regions/dialects" → **CONSENSUS: Mostly true, with concrete exceptions**
- Verdicts: linguist *Mostly true* / TAFL *Mostly true* / skeptic *Partly true*. The skeptic was the lone dissenter to a lower grade, **because the user's phrasing said "across regions AND dialects"** — and that universal quantifier is what breaks.
- **Corrected plain-English picture:** Formal MSA *is* genuinely a single pan-Arab written standard — an Egyptian, an Iraqi, and a Moroccan read the same MSA newspaper with the same consonantal skeleton, the same core grammar, and one shared Unicode alphabet. That premise holds for v1. But "byte-identical everywhere" is false on three checkable points: **(1) numerals** — the Mashriq (Egypt→Gulf) prints Eastern Arabic-Indic digits `٠١٢٣٤٥٦٧٨٩`, the Maghreb prints Western `0123`; **(2) minor orthographic conventions** — Egyptian print often drops the dots on final yāʾ (`ي`→`ى`) and writes tāʾ marbūṭa `ة` as plain `ه`; hamza-seating varies even among educated writers; Maghrebi calligraphic letterforms differ (separate Unicode points exist); **(3)** the moment you leave the formal register, "written Arabic" is not uniform at all (see C2). None of these break *mutual readability*, but a **generator must pick and normalize one convention** or the click-lookup and the diacritization checker will mismatch.
- **Confidence: HIGH.**

### C2 — "Dialect differences are voice/pronunciation, not writing" → **CONSENSUS: Mostly FALSE (the one genuinely dangerous claim)**
- Verdicts: linguist *Partly true / it depends* / TAFL *Partly true / it depends* / skeptic *Mostly false*. **All three flag this as the load-bearing misconception**, and the only disagreement is severity (the skeptic is harshest). Consensus: this is the claim to actively correct in the user's head.
- **Corrected plain-English picture:** True **only** if "Arabic" is silently narrowed to MSA-vs-MSA across regions — there, the differences really are mostly how you *say* the shared written words. But as a general statement it is wrong twice over. **(a) Dialects differ structurally, not just phonetically:** different vocabulary, function words, negation, pronouns, and verb morphology. "I want" is Egyptian *ʿāyez/ʿāwza*, Levantine *biddi*, Maghrebi *bgheet*, MSA *urīdu* — different words and different verb systems, not one word pronounced four ways. The future marker is MSA `سـ`, Egyptian `حـ`, Levantine `رح/بـ`. These surface in **text**, not accent. **(b) Dialects ARE written, pervasively:** hundreds of millions write dialect daily — in Arabic script with *no agreed spelling* (one dialectal word can have 20+ attested spellings; academia had to invent "CODA", a Conventional Orthography for Dialectal Arabic, precisely because none exists naturally), and in **Arabizi / Franco-Arabic**, a Latin-letters-plus-digits chat orthography (`7`=ḥ, `3`=ʿayn, `2`=hamza) that dominates WhatsApp/TikTok/SMS. Written dialect also appears in modern novels, plays, song lyrics, ads, and TV/film subtitles. So the real written landscape a learner meets is MSA **plus** several non-uniform dialectal written conventions.
- **Confidence: HIGH.**

### C3 — "Target MSA for v1; dialect is a later voice/pronunciation modifier" → **CONSENSUS: right decision, WRONG rationale**
- Verdicts: linguist *Mostly true* / TAFL *Mostly true* / skeptic *Mostly true*. Unanimous on the **decision**; unanimous that the **justifying framing is architecturally false**.
- **Corrected plain-English picture:** **Ship MSA-only v1** — it is the one variety uniformly written, taught, and used in news/books/Wikipedia/official text, and (a practical bonus the briefs stress) it is what virtually all high-quality diacritization tools, morphology engines, dictionaries, and Arabic TTS are trained on, which maximizes the reliability of the whole verification stack. But **dialect is not an accent you bolt onto MSA at TTS time.** A dialect is a distinct variety with its own lexicon, grammar, and informal written conventions; you cannot generate Egyptian by re-pronouncing MSA. So **re-label v1 as "we teach the formal written standard"** and treat dialect as **future content/curriculum**, not an audio toggle. Two consequences to bake in now: (1) any MSA TTS voice sounds formal/newscaster-ish, never conversational — fine for reading, misleading if you imply chat ability; (2) be honest in onboarding that the learner is acquiring a register **that is nobody's mother tongue**.
- **Confidence: HIGH** (judges marked C3 *medium* on the nuance but were unanimous and firm on the decision-and-rationale split, so the actionable verdict is high-confidence).

### C4 — "Everyday Arabic is unvocalized; natives supply vowels; fully-vocalized text is sound-out-able; reading unvocalized text is the end-skill; vocabulary is the real gate" → **CONSENSUS: Mostly true — the user's strongest claim**
- Verdicts: linguist *Mostly true* / TAFL *Mostly true* / skeptic *Mostly true*. Unanimous, high confidence, with two consistent refinements.
- **Corrected plain-English picture:** The core is correct and well-evidenced. Everyday MSA (news, books, signage, social) is written as an **abjad** — consonants and long vowels only, short-vowel diacritics (harakāt) omitted; a from-zero beginner genuinely cannot supply them. Fully-vocalized text (Qurʾān, children's primers, your default) is reliably sound-out-able, and **reading unvocalized text is the true terminal skill** — the skeptic adds that experienced native readers are often *faster* on unvocalized text, so your full→partial→none fade is targeting exactly the right competency (and is validated pedagogy: textbooks like *Arabiyyat al-Naas* explicitly fade diacritics). **Two refinements all three judges insist on:** (1) **the gate is vocabulary AND morphology/pattern + context, not vocabulary alone** — `k-t-b` resolves to *kataba* / *kutiba* / *kutub* / *kātib* via root-and-pattern knowledge and syntax, so the skill that lets a reader drop vowels is **pattern recognition**, not just word count; (2) **vocalizing does not remove all ambiguity** — ~74% of word tokens are lexically ambiguous and even fully-vocalized homographs (`دِين` "religion" vs `دَيْن` "debt") still need context, so don't model vowels as the sole disambiguator. The deepest single piece of the gate is the **grammatical case/mood endings (iʿrāb)** — the *final* vowels, which are MSA-formal, which natives drop in speech, and which even advanced learners get wrong.
- **Confidence: HIGH.**

**Net across C1–C4:** three of four claims are sound in conclusion; the framing of C2 (dialect = voice) is the one factual error to correct, and C3's rationale (dialect = later voice modifier) is the one roadmap-misleading framing to fix. The vowel mechanic (C4) is the strongest and well-aligned with how Arabic literacy actually works.

---

## 2. What the user was missing (facts that change the design)

1. **DIGLOSSIA — the single biggest unstated fact.** MSA / fuṣḥā has ~335M users and **zero native speakers** (Ethnologue). Everyone's actual mother tongue is a regional dialect learned at home; MSA is learned later at school. **Design consequence:** a learner who masters reading MSA can read a newspaper but cannot follow two Egyptians talking or a WhatsApp thread. State this honestly in the persona/onboarding or the product over-promises.

2. **Dialects are written, heavily, in exactly the places "read anything online" lands** — social media, comments, lyrics, memes, subtitles — both in non-standard Arabic script and in Arabizi/Franco. **Consequence:** "read anything" implicitly includes a writing system v1 does not teach. Decide explicitly: v1 = read **formal/standard** text; social-media colloquial + Arabizi are **deferred scope**, surfaced as a one-line learner FYI so `3al t2eel` reads as "different convention," not "broken Arabic."

3. **Diacritization is a one-to-many hazard where a wrong vowel is a different REAL word** — `k-t-b` → *kataba* (he wrote) / *kutiba* (it was written) / *kutub* (books) / *kātib* (writer) / *kattaba* (he made write). An LLM-judge asked "is this fluent Arabic?" will happily rubber-stamp the wrong one. The cross-check must verify the diacritized form **against the intended lemma + sense**, not merely "is this valid Arabic." This is the product's correctness backbone, not polish.

4. **Vocalizing ≠ disambiguating.** ~74% lexical ambiguity; native word recognition runs primarily off the **consonantal skeleton + context**, with vowels secondary. The "do I know it without vowels?" self-test is apt, but the real unit of mastery is **skeleton + sense in context**, not vowel recall.

5. **The hardest vowels are the grammatical ones (iʿrāb)** — final case/mood endings (`-u/-a/-i`, tanwīn `-un/-an/-in`). They are an MSA-formal phenomenon natives drop in speech, are where every diacritizer errs most, and are exactly what gets omitted in normal text. **Consequence:** the fade must **distinguish lexical/stem vowels from inflectional case endings** and fade them on separate tracks; lumping them is conflating two competencies. A wrong final vowel is a *grammar* error, and the judge must be told so.

6. **Numerals are an un-scoped reading sub-skill.** Eastern digits `٠١٢٣٤٥٦٧٨٩` look nothing like `0123456789`, dominate Mashriq print, and are **written left-to-right inside right-to-left text**. A learner who reads letters but not `٢٠٢٦` can't read a date, price, or phone number. Add numerals as an **early lesson**, pick a convention (recommend Eastern/Mashriqi for v1), and handle LTR-in-RTL rendering.

7. **RTL + four-way contextual letter-shaping is a first-class correctness concern.** Every letter has isolated/initial/medial/final forms; six letters don't join leftward; click-a-word and per-word vowel toggling must operate on **logical characters, not visual glyphs**, or shaping corrupts — a tripwire a non-reader operator cannot eyeball. Budget an **earlier "decode the glyph" stage** before the "supply the vowels" stage.

8. **"Unvocalized" never means "zero vowel info."** Long-vowel/seat letters (alif `ا`, wāw `و`, yāʾ `ي`), hamza seats (`أ إ ؤ ئ ء`), tāʾ marbūṭa `ة`, and shadda survive even in fully-stripped text. **The fade must strip only the harakāt (fatḥa/kasra/ḍamma/sukūn/tanwīn), never the consonantal skeleton or long-vowel letters** — or it produces non-words.

9. **Pin the generator to high/formal MSA register.** Even within MSA, informal registers blend colloquial vocabulary; news/official/literary text is the cleanest corpus to model on. Otherwise the LLM drifts into colloquialisms the curriculum hasn't taught.

10. **Mastery must key on disambiguated SENSE, not the bare orthographic form.** Because one skeleton maps to multiple words/senses, "mastered *kataba*" must not auto-unvocalize or auto-blend the homographic *kutub/kutiba*. Both the fade and the English→Arabic blend gate on the disambiguated sense, or mastery of one sense wrongly strips vowels off a different word that looks identical.

11. **Clitics glue onto the orthographic word** (article `ال`, prepositions `bi-/li-/ka-`, conjunctions `wa-/fa-`, pronoun suffixes). "Click a word" needs **clitic-aware tokenization**, not whitespace splitting.

12. **TTS hard-depends on diacritization** — every MSA neural voice needs vocalized input — which is an *argument for* MSA v1 (best audio + best automated checking), and simultaneously why dialect can't be a cheap "voice swap" (dialectal TTS and orthography are separate low-resource problems).

---

## 3. Corrected product framing

- **Who:** a complete beginner, zero Arabic, English L1. Personal tool that could grow.
- **What it teaches (honest north star):** *reading formal written Arabic (MSA)* — newspapers, books, Wikipedia, official/literary text — culminating in **reading unvocalized text**. NOT conversational ability, NOT street/social-media Arabic, NOT dialect. Say this in the persona's onboarding.
- **The real gate is vocabulary AND morphology (root-and-pattern recognition + syntactic context), with grammatical case-endings (iʿrāb) as the steepest sub-wall.** Click-to-gloss must therefore surface **root + pattern + features**, not just a translation — that is the muscle that lets a reader drop the vowels.
- **The vowel-fade is simultaneously a grammar-difficulty ramp**, because iʿrāb lives in the very vowels being faded. That is a feature — exploit it by fading case endings on a separate, later track.
- **Deferred-but-named scope:** dialect content, Arabizi, and "read anything social" are explicitly v2+ (content effort, not a toggle). Numerals and glyph-decoding are *in* v1 as early lessons.
- **Correctness is the product, not a feature.** Because no human in the loop can read Arabic, the verification layer (§6) is load-bearing: the learner must **never see red-band content**.

---

## 4. The dual-scaffold design (two fades, one mastery state)

Two independent scaffolds run **alongside** each other, both driven by the **same per-(user, lemma, sense) mastery record** that already drives FSRS in the Spanish baseline:

**(a) English → Arabic language blend** — does this token render in English or in Arabic? (Identical mechanic to the Spanish baseline's `lang` tag.)
**(b) Vocalization fade** — for a token that renders in Arabic, how many harakāt are shown: full → partial → none?

### One stored canonical form drives everything
Per (user, lemma, sense), store the **fully-vocalized canonical string** (plus its bare skeleton). The fade, the global toggle, and TTS are then **pure string operations** over that one verified form — never re-diacritization at render time. This is the single most important implementation rule: **fade by subtraction, never regenerate.** Regenerating at each fade step reintroduces error at every level; subtracting from one verified full form makes partial and bare states inherit the full form's correctness for free.

### Global vowel on/off TOGGLE (the user's manual control)
A trivial render flag: render `diac` vs `skeleton` per token, no regeneration, no re-validation. It is the **self-test** ("do I still know this word without the vowels?"). It overlays the automatic per-word fade — i.e. the learner can globally strip all vowels to test themselves even on words still in the "full" fade state.

### Per-word AUTOMATIC fade (driven by mastery)
Each word's fade state is a function of its mastery: `new/learning` → full; `familiar` → partial; `known` → none. Because it reads the same FSRS-derived status the blend reads, the two scaffolds stay in lockstep with zero extra state. A word **click** lowers status (a soft "I didn't know that"), which can *re-add* vowels — the fade **breathes**, it does not monotonically strip.

### Is PARTIAL vocalization feasible and useful? **YES — and it is the backbone of the fade.**
Partial/minimal diacritization is real, researched ("Take the Hint" / 2SDiac 2023; "Context-Contrastive Inference" 2024; "Automatic minimal diacritization"), and what skilled writers do in the wild (one disambiguating haraka on an otherwise-bare word). **Define "partial" via the morphological analyzer's ambiguity set**, not a fixed rule: run the bare skeleton through CAMeL Tools' analyzer — if it has **one** legal analysis, no marks are needed; if **many**, keep only the vowel(s) that disambiguate to the intended sense. This makes our fade *the* canonical minimal-diacritization use case. **Two fade tracks, not one:** (1) lexical/stem vowels (needed to know the word); (2) inflectional case/mood endings (iʿrāb — harder, grammar-driven, learned last). **Drop the case ending first** in the fade ladder, because it is the least lexically informative, the hardest, and exactly where the models err anyway — so removing it early both matches pedagogy and removes the least-reliable mark from the rendered text.

### Does word-level blending stay grammatical in Arabic? **Not always — this is a real new risk.**
Inserting an English word into Arabic word order (default VSO, post-nominal adjectives, gender/number agreement, definiteness via `ال` and the construct state *iḍāfa*) can produce ungrammatical hybrids. Code-switching linguistics gives the rule: switches are **blocked at bound morphemes** (free-morpheme constraint) — you cannot attach Arabic `ال` or a pronoun suffix to an English stem, and switching right after a function morpheme is dispreferred. **Safe insertion points = whole noun phrases and verbs at clause boundaries. Unsafe = mid-construct-state, or splitting a clitic from its host.** The robust fix (adopted from brief 16) is to **generate the full Arabic sentence first, verify it, then anglicize the not-yet-mastered words as a post-process** — so the blend never free-form-generates a Frankenstein splice, and a token that comes out half-Latin/half-Arabic is auto-rejected by the morphology pass.

---

## 5. The diacritization pipeline

**Goal:** emit fully-vocalized MSA the operator can trust without reading it, and feed correct vocalized input to TTS.

### Recommended stack
1. **Generate with the agentic frontier LLM (Claude).** This is the single most product-relevant number in the research: on the clean, contamination-controlled **SadeedDiac-25** benchmark, **Claude 3.7 Sonnet led the field at 1.39 DER / 4.67 WER *with* case endings and only 0.82% hallucination** — beating GPT-4 (3.86 DER), Gemini Flash 2.0 (3.19), and even the specialized Sadeed model on that harder set. The 2024–2025 consensus is that frontier LLMs now *beat* specialized diacritizers. So the LLM already in the loop **is** the diacritizer — no separate ML diacritizer needs to be the primary.
2. **CAMeL Tools (MIT, pip, in-process Python) as the deterministic spine** — `camel_tools.utils.dediac` for the strip/fade and round-trip; its **morphological analyzer** to (a) enumerate the legal vocalizations of a skeleton (the basis of the partial-mark selector and the membership check) and (b) emit the learner-breakdown fields (`diac`, `lex`/lemma, `root` e.g. `ك.ت.ب`, `pattern`, `pos`, `gloss`, `caphi` phonetic).
3. **CATT (Character-based Arabic Tashkeel Transformer, Apache-2.0 as of 2024, offline) as a cheap independent second diacritizer** — its job is to *disagree*: two independent diacritizers disagreeing on a word is the highest-signal error flag for the judge.
4. **TTS is solved *for us* precisely because we keep the full form.** Feed Azure/Google MSA voices the **stored validated full vocalization regardless of the visual fade state** — the learner *sees* fewer vowels but always *hears* the correct word. Azure's Arabic voices cut pronunciation errors 78% via vocalized input. **Never let a TTS engine's own auto-diacritizer (e.g. Polly "Zeina") pick the vowels** — it can disagree with the on-screen vocalization and teach the wrong word.

### Ordering (critical, and a delta from Spanish): **diacritize → verify → TTS.**
TTS hard-depends on vocalized input, so audio is generated **from the verified full form, after the verification gate**, never from bare consonants and never before verification.

### Realistic accuracy expectations
- Frontier-LLM DER ~1.4% / WER-with-CE ~4.7% on a clean MSA set — **good enough only if gated**, not unconditionally.
- **Case endings (iʿrāb) are where everything errs most** and are the final vowel the beginner reaches last — render them conservatively/pausally early and treat final-vowel disagreement between tools as **non-blocking** in v1.
- **Two failure classes need different guards:** wrong vowel (meaning shift) vs hallucinated/dropped letter (corruption). The dediac round-trip catches the second; the membership + semantic checks catch the first.
- **Don't trust vendor/paper DER headlines** — 34.6% of the common Fadel test set was found verbatim in training data. Trust your own clean gold set.

### Caching
A verified `(lemma, sense, diac, gloss, root, pattern)` tuple is **reusable forever** and is the source of truth for blend, fade, toggle, breakdown, **and** TTS. Cache keyed by `(lemma, sense_id)`; audio keyed by content-hash of the vocalized string + voice. Verification cost amortizes to near-zero as the learner's vocabulary stabilizes — most content is pre-generated, so the expensive checks rarely touch the live path.

---

## 6. The verification layer (concrete v1 design)

The trust mechanism. Three layers, **deterministic-first**, with confidence-gating, golden sets, and sampled native spot-checks. The crown-jewel insight: **we know the intended sense *before* we vocalize, which turns "is this vowel right?" into a dictionary lookup.**

### Per-word diacritization check (hot path, cached)
1. The agentic loop emits not just diacritized Arabic but the **intended lemma + English gloss + features** it meant.
2. **Dediac round-trip (hard gate, no Arabic literacy needed):** `dediac(LLM_output) == original_skeleton`? Catches hallucinated/dropped/transposed letters instantly.
3. **Morphological-analyzer membership (CAMeL `analyze` on the bare skeleton):** the LLM's vocalized form must be one of the legal `(diac, lex, gloss, pos)` tuples, AND the tuple whose `gloss` matches the **intended** sense must be the one chosen. Intended-gloss → different diac than emitted ⇒ **reject**. The known meaning *fixes* the vocalization.
4. **Tool consensus:** require CATT (and/or Farasa) to agree on the **core-word** diacritics; **ignore case endings** (tools disagree most there, beginners don't need them yet). Disagreement → flag.
5. **LLM-judge tiebreak only when tools disagree or the word is out-of-lexicon** (`NO_ANALYSIS`/backoff — which is *not* automatically wrong for proper nouns/neologisms): 2–3 **diverse-family** models (Claude + Gemini + GPT so errors decorrelate), **refutation-prompted** ("Find the error in this diacritization, or state there is none" — never "is this right?", which invites sycophantic yes), majority gate.

### Generated blended sentence check
Generate the **full Arabic sentence first**, verify it, *then* anglicize not-yet-mastered words and apply the fade (blend as a post-process over verified Arabic — removes splice-grammar as a failure class). Verification: (a) CAMeL tokenize + disambiguate the Arabic span — `NO_ANALYSIS` on any non-proper-noun token = junk word = reject; (b) **round-trip** — back-translate the Arabic to English with a *different* model than generated it, embed both, require cosine ≥ ~0.88 against the intended meaning; (c) diverse-model refutation jury on grammaticality, majority gate.

### Writing-correction check (catch over-correction)
Run the learner's text *and* the proposed correction through the same diacritization/morphology checks. Require the judge to **classify each edit** (real error / stylistic / no-op) and **drop no-op edits** — directly attacking the known Arabic-GEC failure where punctuation edits have the highest over-correction rate. Bias toward **precision over recall** (F0.5 mindset, weighting precision 2×): better to miss an error than to "correct" already-correct Arabic and confuse a beginner. Blend-aware: an English word the learner used because they don't know the Arabic one is **not** an error.

### Confidence gating (three bands; learner never sees red)
- **GREEN** = all deterministic checks pass + jury unanimous → surface normally.
- **YELLOW** = minor jury disagreement / round-trip cosine 0.80–0.88 → surface but **suppress the vowel-fade for that word** and add a margin note.
- **RED** = any deterministic check fails / cosine < 0.80 → **withhold**: substitute a known-good cached word or fall back to English. Tune the 0.88/0.80 cuts on the golden set to a target risk ≤ ~2% in green.

### Hot-path vs offline split
- **Hot path:** L1 deterministic checks (dediac round-trip + CAMeL gloss-constraint + tool consensus) and L2 round-trip cosine — both cheap and **cached per (lemma, sense)**.
- **Offline/batch:** the expensive diverse-model refutation jury, run when **pre-generating curriculum content**; it touches the live path *only* when L1/L2 flag (out-of-lexicon, tool disagreement, live writing corrections that can't be pre-baked).

### Golden sets (built cheaply, without an Arabic-literate operator)
- Seed diacritization regression from **already-diacritized gold corpora** (Tashkeela, WikiNews-2014/2024 multi-reference) — free ground truth.
- Glosses/grammar from the **CAMeL lexicon** (pre-validated diac+gloss pairs).
- Corrections from **QALB-2014/2015** parallel error→correction data.
- Grow a product-specific set by **logging every red/yellow item and what shipped**, and have a native speaker adjudicate a sample.
- **One-time seed:** pay a freelance Arabic checker once for ~100–200 hand-verified items; thereafter trust Claude+CAMeL+CATT agreement as the regression baseline.

### Sampled native-speaker calibration (ground-truth the judges, since the operator can't)
Weekly **Prolific** batch of 50–100 sampled items (weighted to yellow-band + fade transitions), ~**$50–150/month**. Compute Cohen's κ vs the automated gate; **target κ ≥ 0.8** (Gemini-as-judge has hit 0.87). κ drop = judges drifted → re-tune thresholds. Every model swap / prompt change / fade-logic change reruns the golden set and gates deploys on no-regression (Braintrust is the natural home for scorers + traces).

---

## 7. Revised v1 architecture deltas (from the Spanish baseline `20-SYNTHESIS-architecture.md`)

The baseline's load-bearing primitive survives unchanged: **one per-(user, lemma, sense) mastery state drives FSRS, the blend, and the correction policy.** Arabic adds a **second fade** on the same state and a **mandatory verification gate** on every Arabic byte. Deltas:

| Area | Spanish baseline | Arabic delta |
|---|---|---|
| **Generation ordering** | One streamed Sonnet call emits blended tokens directly; deterministic ratio+coherence guard; regenerate on miss. | **Generate full vocalized Arabic sentence → verify (§6) → THEN anglicize unmastered words + apply vowel fade.** Blend becomes a post-process over verified Arabic, not free-form bilingual generation. Removes splice-grammar as a failure class. |
| **New pipeline stage** | n/a | **Diacritization stage** (Claude diacritizes; CAMeL + CATT cross-check; §5). Sits between generation and rendering. |
| **TTS ordering** | TTS per-word, pre-warmed, any time. | **TTS strictly after diacritization + verification**, fed the verified **full** vocalized form regardless of visual fade. Never bare consonants; never the engine's own auto-diacritizer. |
| **Second fade** | Single `lang` blend. | **Two scaffolds on one mastery state:** `lang` blend + **vocalization fade** (full→partial→none, by subtraction). Token schema gains `diac`, `skeleton`, and a per-token `vowelState`. |
| **Segmentation** | spaCy whitespace (Spanish trivial). | **Clitic-aware tokenization** (CAMeL/Farasa): `ال`, `bi-/li-/ka-`, `wa-/fa-`, pronoun suffixes attach with no space. Click-unit = clitic token, not whitespace word. |
| **Breakdown panel** | lemma/POS/feats from dependency parse. | **Root-and-pattern morphology**: surface `root` (`ك.ت.ب`), `pattern`, `pos`, features, `caphi` phonetic — the muscle that teaches vowel-dropping. Straight from CAMeL's analyzer. |
| **Rendering** | LTR, single script. | **RTL + bidi isolation**: wrap every token span in `<bdi>` / `dir="auto"`; prefer Unicode isolates (U+2066–2069) over embeddings; operate on **logical chars, not glyphs** (four-way letter shaping). **Numerals LTR-inside-RTL.** Ship **Amiri or Scheherazade New** (designed for harakāt), not Noto Naskh (diacritics render too small for a vowel-teaching tool); line-height ≥1.8, Arabic sized ~10–15% larger. |
| **Numerals** | n/a | **Early lesson + render handling.** Pick a convention (recommend **Eastern Arabic-Indic** for v1), teach the digit glyphs explicitly, render LTR within RTL. |
| **Verification layer** | Deterministic ratio+coherence guard; LanguageTool false-positive cross-check (2nd lang). | **Full three-layer trust stack (§6):** dediac round-trip + CAMeL membership + tool consensus + diverse refutation jury + green/yellow/red gating + golden sets + weekly native κ calibration. The learner **never sees red**. |
| **Blend grammaticality** | Naive content-word insertion stays grammatical at high ratio (SVO, cognates). | **Caveated:** VSO, post-nominal adjectives, agreement, `ال`/iḍāfa, free-morpheme constraint. Insert only whole NPs/verbs at clause boundaries; never attach Arabic clitics to English stems; reject half-Latin/half-Arabic tokens. Arabic is closer to the baseline's "Japanese stress-test" difficulty than to Spanish. |
| **Register pin** | n/a | Pin generator to **high/formal MSA** (news/official/literary), not Qurʾānic (over-marked/archaic) and not colloquial. |
| **Infra** | Cloud Run + Neon + Upstash + R2/CDN + Terraform/OIDC; LLM-heavy hot path. | Same, **plus a CAMeL Tools / CATT Python sidecar** (in-process or subprocess) for diacritization cross-check + morphology — a new Terraform module. Cache the verified `(lemma, sense, diac, root, pattern)` tuple as a first-class store. |

---

## 8. Updated top risks (ranked)

| # | Risk | Mitigation |
|---|---|---|
| **1** | **Diacritization correctness — a wrong vowel is a different real word, silently, and no human in the loop can catch it.** Highest-severity, highest-frequency, silent. | The three-layer gate (§6): dediac round-trip (hard) + CAMeL morphological-analyzer **membership against the intended sense** + CATT/Farasa core-word consensus + diverse refutation jury. **Verify against intended lemma+sense, never "is this fluent Arabic."** Withhold red-band. Weekly native κ calibration. |
| **2** | **TTS teaches a wrong pronunciation** — wrong diacritization, or an engine auto-diacritizer, produces wrong audio the learner can't catch. | **Generate audio only from the verified full vocalized form, after the gate.** Never feed bare consonants; **never** use a TTS engine's own auto-diacritizer. Optionally judge audio→text round-trip on a sample. |
| **3** | **Frankenstein blended sentences** — English word inserted mid-iḍāfa / breaking agreement / splitting a clitic; Arabic's VSO + agreement make this far likelier than Spanish. | **Generate full Arabic → verify → anglicize as post-process.** Insert only whole NPs/verbs at clause boundaries; never attach Arabic clitics to English stems; morphology pass rejects half-Latin/half-Arabic tokens. |
| **4** | **Over-promise from diglossia** — "learn to read Arabic" implies chat / social-media / dialect ability MSA-v1 cannot deliver. | Onboard honestly: "you're learning to read **formal** written Arabic." Scope dialect + Arabizi + social as named deferred content. One-line Arabizi FYI so learners aren't confused by `3`/`7`. |
| **5** | **Homograph cross-contamination** — mastering one sense of a skeleton wrongly strips vowels / blends a different word that looks identical. | **Mastery, fade, and blend all gate on disambiguated `(lemma, sense_id)`, never the bare orthographic form.** CAMeL `lex`+gloss supplies the sense key. |
| **6** | **Fade corrupts the word** — stripping a long-vowel letter or the consonantal skeleton produces a non-word; or fading lexical and case vowels as one blob conflates competencies. | **Fade by subtraction from one verified full form; strip only harakāt (U+064B–0652), never skeleton or long-vowel letters.** Two fade tracks: lexical vowels vs case endings (iʿrāb); drop the case ending first. NFC-aware comparison. |
| **7** | **Bidi/RTL rendering corruption** — un-isolated spans, glyph-vs-logical-char operations, numerals breaking order; invisible to a non-reader operator. | `<bdi>`/isolates on every token; operate on logical characters; numerals LTR-in-RTL; Amiri/Scheherazade New; visual regression snapshots on a fixed set as the operator's only eyeball-able guard. |
| **8** | **Over-correction of learner writing** — model "fixes" correct Arabic or the allowed English fallback (Arabic GEC's punctuation over-correction is documented). | Classify-then-filter edits, drop no-ops, F0.5 precision-bias, blend-aware policy (below-stage English ≠ error), verify-pass + LanguageTool/Farasa cross-check. |
| **9** | **Benchmark/judge over-trust** — a model scoring 0% on one passage (vs the 68% DER Llama outlier) lulls you into single-model trust; judge sycophancy rubber-stamps wrong vowels. | **Consensus, not a single benchmark, is the unit of trust.** Diverse-family jury, refutation framing, never self-grade. Own clean gold set over vendor headlines (contamination is rampant). |
| **10** | **Latency from the added verification + sidecar stages.** | Deterministic checks + cached tuples on the hot path; expensive jury **offline at pre-generation**, hot only on flag. Verified tuples cached forever; cost amortizes as vocabulary stabilizes. |

---

## 9. Open decisions for the user

1. **Reading-first vs balanced read/write.** Reading is the locked north star, but the read/write balance is open. Corrections (write) are the most over-correction-prone and the most expensive to verify — **how much writing ships in v1?** (Recommendation: reading-heavy v1, cloze-style minimal writing, full free-writing correction deferred.)
2. **MSA-only forever vs add a dialect later.** Confirm v1 = formal written standard only, with dialect as **future content (not a voice toggle)**. If yes, which dialect first if/when added (Egyptian and Levantine have the most written-corpus + TTS support)?
3. **Does "read anything" require eventual dialect + Arabizi support?** If the long-term promise is "read what's actually on a screen" (social, lyrics, subtitles), that is a second writing system. Decide whether to (a) keep the promise scoped to formal text, or (b) roadmap dialectal reading as an explicit v2+ epic.
4. **Vowel-toggle granularity.** Is the toggle purely global on/off, or also per-fade-track (lexical vowels vs case endings independently)? And is the fade **unit** the orthographic word or the clitic-token?
5. **Partial-vocalization semantics.** "Keep only disambiguating marks" (driven by the analyzer's ambiguity set) vs "keep marks for vowels the learner hasn't mastered yet" — two different fade meanings. Which (or both, on the two tracks)? Needs a native-speaker sanity check that partial vocalization reads naturally rather than confusingly.
6. **Case endings (iʿrāb): pausal vs full for beginner text.** Render conservatively/pausally early (less confusing to sound out, matches how MSA is often read) or full case system from day one? And: fade case endings on a **separate, later track** from lexical vowels — confirm.
7. **Numeral convention for v1.** Eastern Arabic-Indic `٠١٢٣` (Mashriq/Gulf print, recommended) vs Western `0123` (Maghreb). Pick one, normalize the generator to it, teach it as an early lesson.
8. **Native-checker budget & cadence.** Approve ~$50–150/month for weekly Prolific calibration batches + a one-time ~$100–300 gold-set seed. Without an Arabic-literate operator this is the only ground-truth on the judges.
9. **CAMeL/CATT deployment topology.** Python sidecar service vs subprocess call from the Node/TS server — affects the Terraform module and the hot-path latency budget. Decide before infra is laid.
10. **Two-diacritizer disagreement UX.** When CATT and Claude disagree on a word: auto-suppress audio + flag (conservative) or surface an "uncertain pronunciation" UI state (transparent)? Ties to the yellow-band design.
