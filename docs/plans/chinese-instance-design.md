# language-agent (Chinese instance) — Build-Ready Design Spec

## Status & orientation

This is the **Chinese instance** of the language-agent reading tutor — the Traditional-script + pinyin + Mainland-Putonghua counterpart to the Arabic `vocabulary-system.md` / v1 design spec. It reuses the same engine (the blend-and-fade architecture, the mastery-driven agentic selection loop, and the verification-gate discipline) and diverges only where the Han script demands: the Arabic RTL/bidi/cursive-shaping subsystem is deleted, there is no inflectional morphological analyzer, the single mastery latent becomes **two coupled latents (Latent W + Latent C)**, the single canonical diacritized form becomes **two pinyin layers (citation-pinyin + surface-pinyin)**, and TTS is driven by SSML phoneme override. Every decision below is **LOCKED** and stated as decided; the divergences are catalogued in §10.6. Terminology is fixed throughout: **Latent W / Latent C**, **citation-pinyin / surface-pinyin**, **the gate**, **the tuple**.

## LOCKED decisions

| Area | Locked decision |
|---|---|
| **North-star** | Read authentic, unannotated **Traditional-script Standard Written Chinese** (Taiwan/HK/Macau publishing register) with **Mainland Putonghua** pronunciation. |
| **Pronunciation standard** | Mainland Putonghua, bound as **one global config** across the verification dictionary's reading field, the TTS voice, and the displayed pinyin — these three never disagree. |
| **Phonetic scaffold** | **Pinyin** (Latin diacritic ruby), not zhuyin — one phonetic system end-to-end, including the production-side IME. |
| **Non-goals** | Mainland **Simplified** display text; **colloquial written Cantonese**; **Classical / Literary (wenyan)**. |
| **Correctness constraint** | Neither learner nor operator reads Chinese; **every target-language byte clears the gate before display**. The learner never sees red. |
| **Mastery model** | **Two coupled latents**: Latent W (per-(user, word, reading) FSRS recall, target R ≈ 0.8) + Latent C (per-(user, character) pyBKT recognition P(known)). |
| **Three fade dimensions** | (1) meaning blend → Latent W; (2) segmental pinyin → gated by Latent C; (3) tone → own sub-track, faded **last**, mastery-gated + actively retrieved. |
| **Two pinyin layers** | **citation-pinyin** (per word + per char → accounting + click-breakdown) and **surface-pinyin** (per occurrence; g2pW base reading + a rule-based sandhi/neutral-tone/erhua resolver, in-sentence → ruby display + TTS). |
| **Late tone state** | **Character-borne tone cue** (color + redundant contour), colorblind-safe, taught + gate-verified. |
| **The blend** | Generate **verified Traditional first**, then **anglicize-DOWN** unmastered words by deterministic subtraction. Chinese = Matrix Language (word order + all system morphemes); English = bare content morphemes only. |
| **Never-anglicize allowlist** | Classifiers, aspect 了/著/過, resultative + directional complements incl. the 得/不 potential infix, 離合詞 separable verbs, the 把 frame, the 是…的 bracket, 的/地/得. |
| **The gate** | Deterministic-first, multi-leg: CC-CEDICT (Traditional) + Unihan `kMandarin` **citation-reading** membership → g2pW in-sentence **base-reading** agreement → diverse-vendor LLM refutation jury (downgrade-only). The **surface** form is verified by g2pW agreement + the sandhi resolver's explicit word-grouping, **never by dictionary membership**. Bands **GREEN / YELLOW / RED**; RED is withheld. |
| **Segmentation** | One pinned standard end-to-end (**Academia Sinica / CKIP**); a **HanLP model configured to that AS/CKIP standard** is the default segmenter, with jieba/pkuseg voters **normalized to the AS standard before agreement is scored**; click-unit = FSRS unit; 離合詞 discontinuous spans allowed. |
| **The tuple** | First-class cached store and single source of truth for blend/fade/breakdown/TTS. Stores `simplified_word` now; tone as **marks not numbers**; NFC-normalized. |
| **Curriculum (cleanroom)** | Word spine = **TOCFL / SC-TOP 8000**; glyph standard = **MOE 4808**; frequency = **Academia Sinica Balanced Corpus** (not SUBTLEX/Jun Da); HSK 3.0 = coarse Taiwan-filtered, never-displayed prior. |
| **Coverage** | Dual floors: **word-coverage 98% / 95% stretch** + a separate **character-coverage decoding-load floor**; front-load the ~1000 highest-frequency characters (~90% running-text coverage). |
| **Novelty budget** | Shared **≤3 novel items / turn** across meaning + pinyin + tone + structure; never 2 novel in one clause; struggle-hold → budget 0. |
| **Rendering** | LTR only (RTL subsystem deleted); HTML `<ruby>`/`<rt>` authored mono-ruby; fade = **opacity on a reserved band**, never `display:none`; the meaning blend = **inline base-text swap**. |
| **Writing (v1)** | Handwriting **DORMANT**; v1 = pinyin-IME composition + cloze; every IME/GEC string re-enters **the same gate**; GEC is F0.5, blend-aware; productive success updates a **separate, down-weighted** state. |
| **TTS** | **Azure** primary (SSML `<phoneme alphabet="sapi">` + Custom Lexicon), **Google zh-CN** + **Amazon Polly (Zhiyu)** redundant; driven from **verified surface-pinyin**, never raw characters; per-engine tone-digit adapter. |
| **Infra** | **Node/TS server + Python sidecar** (pypinyin + its `tone_sandhi`-based surface resolver, g2pW/g2pM, AS-configured HanLP, OpenCC) + IDS/Unihan/MMH data build; **FSRS** (Latent W) + **pyBKT** (Latent C); Terraform module for the sidecar + tuple store. |
| **Sense granularity** | v1 keys Latent W on **reading, not fine-grained sense**; sense-splitting is a **flagged upgrade (recorded deviation)** on the same mastery state. |
| **Ground truth** | Traditional eval slice + **weekly sampled native-checker calibration (Cohen κ ≥ 0.8)** + one-time gold seed. |
| **GPL call** | **HanLP (Apache-2.0), configured to the AS/CKIP standard,** is the default; **CKIP-Transformers (GPL-3.0)** — the AS-standard reference implementation — sits behind an explicit recorded GPL decision and may be adopted as the hosted standard-defining segmenter, quarantined; never a launch blocker. |
| **Vertical text** | **DORMANT** (idiomatic vertical annotation is inter-character zhuyin, which conflicts with the locked pinyin scaffold). |

---

## 1. Product framing, scope & the honest north-star

### 1.1 Who, what, why

This product is a chat-based reading tutor that takes a **zero-Chinese, English-L1 absolute beginner** to the point of reading **authentic, unannotated Traditional-script Standard Written Chinese** — the prose of Taiwan/HK/Macau publishing: books, periodicals, signage. The learner starts from nothing. The tutor closes the gap by progressively **blending English into the target language**: it generates a verified Chinese sentence, then anglicizes *down* the words the learner has not yet mastered, so early text is mostly English with a few Chinese anchors and late text is unannotated Chinese. Around that base text it runs a **margin channel** (per-word notes), **click-any-word lookup** (meaning + per-character breakdown + TTS audio), and **writing correction**. The whole loop is driven by an agentic LLM that picks what to introduce, what to fade, and what to review each turn against a per-learner mastery model.

A hard fact shapes every decision below: **neither the learner nor the operator reads Chinese.** There is no human in the loop who can catch a wrong character. That is why this is a verification product first and a tutoring product second (§1.3).

This is the **Chinese instance** of the same engine that powers the Arabic vocabulary system; it reuses the blend-and-fade architecture, the mastery-driven selection loop, and the verification-gate discipline, and diverges where the script demands (the divergences are catalogued in §10.6 — the RTL/bidi/cursive-shaping subsystem is deleted, there is no inflectional morphological analyzer, there are two coupled latent states instead of one, and there are two pinyin layers instead of one canonical form).

The product's **north star is the authentic, un-generated passage** — text we did not write. Generation (§4, §5) is the on-ramp; reading real Taiwan/HK/Macau prose is the destination. Authentic text therefore has its own ingestion pipeline (§5.4), which shares the gate and the tuple store but performs no generation and no anglicize-down.

### 1.2 The honest north-star, the non-goals, and the onboarding honesty note

**North-star (LOCKED):** *read Traditional-script Standard Written Chinese with standard Putonghua pronunciation.* The pronunciation standard is **Mainland Putonghua**, bound as **one global config** across three surfaces that must never disagree — the verification dictionary's reading field, the TTS voice, and the displayed pinyin. The phonetic scaffold is **pinyin** (Latin diacritic ruby), not zhuyin; one phonetic system is used end-to-end, including the production-side IME.

This pairing — Traditional *script* read with Putonghua *pronunciation* — is deliberate and is the source of the one tradeoff we state up front rather than hide. The vocabulary spine is Taiwan-register (TOCFL/SC-TOP), but words are taught with their **Mainland reading**: 垃圾 is taught **lājī**, though Taiwan says *lèsè*; 和 ("and") is taught **hé**, not Taiwan *hàn*. This is a defensible target (the formal Mainland reading of Traditional script is a real, coherent register), but it is **not** "the Chinese a Taiwanese person speaks" and it is **not** "the Chinese internet."

**Named non-goals (state explicitly to the learner):**
- **Mainland Simplified text** — not a display target. (We *store* the Simplified form of every word now (§7), so "read Simplified too" later is a display/ladder module on the same mastery state — but Simplified is never on the v1 display path.)
- **Colloquial written Cantonese** — out of scope.
- **Classical / Literary Chinese (wenyan)** — out of scope.

**Onboarding honesty note (shown at first run, LOCKED wording intent):** *"This teaches you to read Traditional characters with the formal Mainland (Putonghua) pronunciation. Taiwan's own pronunciation (Guoyu) differs on some words — e.g. 和 is taught hé not hàn, 垃圾 is taught lājī not lèsè. You'll read Taiwan's books and signs; you won't sound exactly like a Taipei native, and this is not slang or internet Chinese."* We surface this at onboarding rather than letting the learner discover the register mismatch in the wild, because the learner cannot self-diagnose it.

### 1.3 Correctness is the product

The defining constraint is not a feature — it is the reason the product exists. Because no one in the loop reads Chinese, **a wrong target-language byte is not a typo; it silently teaches a different real word.** Show 髮 (hair) where 發 (to emit) was meant and the learner durably learns the wrong character with full confidence, with no error signal ever firing. Standard software-correctness intuitions ("a bug shows up as a crash or a visibly broken screen") do not hold: the failure mode here is a *plausible, well-formed, wrong* sentence.

Therefore **every target-language byte passes an automated verification gate before it reaches the screen**, and the gate is **deterministic-first** (specified in full in §6): CC-CEDICT (Traditional field) + Unihan `kMandarin` must *contain* the stored **citation** reading after variant→MOE-canonical normalization and NFC; **g2pW** (context-aware) must *agree* on the in-sentence **base** reading; a **diverse-vendor LLM refutation jury** ("find the error or state there is none," majority gate) can only *downgrade*, never substitute, the deterministic result. The gate emits three bands: **GREEN** (show normally), **YELLOW** (show but suppress that word's fade and add a margin note), **RED** (**WITHHOLD**: substitute a known-good cached word or fall back to English). **The learner never sees red.** Untrusted inputs that re-enter the same gate include OpenCC S→T output (many-to-one: 发→{發, 髮}; 干→{干, 乾, 幹}) and every IME/GEC "correct answer" string on the production side — both can emit wrong-but-real bytes, so both route through the one shared chokepoint. Membership in a dictionary proves a reading is *a* valid reading, never *the* right one (行 is validly xíng *and* háng), which is why the gate also pins an in-sentence g2p agreement leg, a hand-pinned function-word heteronym head set (的/地/得, 了, 不, 一, 行, 重, 著, 和) no model may override, and its own numeral rule.

---

## 2. The mastery model (two coupled latent states)

The learner is modeled by **two coupled latent states**, not one. An earlier draft of this spec carried a "single mastery state" slogan; that is **amended here and superseded**. Reading authentic Traditional-script Chinese requires two things that decouple in practice — knowing what a *word* means and being able to *decode the characters that spell it* — and they are driven by different evidence, gate different fades, and fail in different ways. Conflating them silently teaches the wrong thing: a learner who knows 銀行 means "bank" but cannot recognize the glyph 行 will be stranded the moment 行 appears in 行李 or 行人, and a passive pinyin crutch would have hidden that gap.

### 2.1 Latent W — per-(user, word, reading) graded recall

**What it stores.** One FSRS (free-spaced-repetition scheduler, MIT) memory state per `(user_id, word_reading_key)`, where `word_reading_key = (traditional_word, reading_id)`. FSRS maintains the standard triple — **stability**, **difficulty**, and a derived **retrievability R** — and schedules reviews against a target **R ≈ 0.8** (LOCKED). The key is the **verified tuple's** `(traditional_word, reading_id)`, so the FSRS unit, the click-lookup unit, and the segmentation unit are **the same unit** end-to-end (§6.7: one pinned CKIP/Academia-Sinica standard makes the click-unit equal the FSRS unit).

**v1 keys on reading, not sense.** The key is `(word, reading_id)` — it distinguishes 行 *xíng* from 行 *háng* (a heteronym, two readings) but does **not** split senses *within* a single reading (e.g. 打 "hit" vs. 打 "make a phone call", both *dǎ*). Sense-splitting to `(word, reading_id, frozen_sense_id)` is a **flagged upgrade, not v1** — a **recorded deviation**. The tuple already carries an `optional frozen_sense_id` slot (seeded from a pinned Kaikki/Wiktextract dump with frozen sense IDs) so the upgrade is a key-refinement on the existing store, never a re-verification. Until that flag is set, all senses of one reading share one W-state; the cost (a polysemous word's harder senses are masked by its easy ones) is accepted for v1.

**What it drives.** Latent W drives the **English↔Chinese meaning blend** (fade dimension 1). High R on a `(word, reading)` means that word is eligible to render as its verified Chinese glyph; low R means it is **anglicized down** by subtraction — the English content morpheme is swapped into the base text in place of the glyph (an inline base-text swap, *not* a second ruby — see §8). W governs the *meaning* axis only; it does **not** gate pinyin.

### 2.2 Latent C — per-(user, character) recognition probability

**What it stores.** One BKT (Bayesian Knowledge Tracing) state per `(user_id, character)`, run on **pyBKT (MIT)**. It tracks **P(known)** for each individual Traditional character (the `per_character[traditional]` field of the tuple), updated by the standard four-parameter model (prior, learn, slip, guess) every time that character recurs **across different words**. A character met in 你好, then 你們, then 其他 accrues evidence toward P(known) on each impression — the character is learned *through* the words that contain it.

**Why character is co-primary, not a weak prior.** Roughly **1,000 highest-frequency Traditional characters cover ~90% of running text**; the MOE 4808 common-character set is the canonical glyph standard and supplies commonality tiers. A reader who cannot recognize a character has **no decoding fallback** — Chinese is non-alphabetic, so an opaque glyph is not "sound-it-out-able" the way an unfamiliar but spelled-out word is. Character recognition is therefore **co-primary with the word**, front-loaded in the curriculum (the ~1000 highest-frequency characters first), and tracked as a first-class latent — not a derived prior on W.

**What it drives — the gated pinyin fade.** Latent C **gates the segmental pinyin fade** (fade dimension 2). Pinyin ruby fades on **character recognition**, never on word mastery. The rule, stated plainly: **fade the surface-pinyin above a glyph only when P(known) for that character clears threshold**, regardless of how well the *word* is known. This is the central reason the two latents cannot be merged — fading pinyin on word mastery would strip the phonetic scaffold off characters the learner still cannot decode, the exact failure the model exists to prevent. (Tone is a separate sub-track, faded **last** and mastery-gated + actively retrieved — see §3; W and C between them do not fade tone.)

### 2.3 Credit assignment — leak-free trials only

A scaffold that is *visible* on an impression **leaks** the dimension it scaffolds, so an impression where a scaffold was shown carries **no evidence** for that dimension. The rule is LOCKED:

- **Meaning evidence (updates Latent W) is collected ONLY on pinyin-HIDDEN impressions.** If the word rendered as its glyph with pinyin still showing, the learner may have decoded meaning *from the sound* — that impression does not credit W.
- **Pronunciation evidence (updates the relevant phonetic state) is collected ONLY on gloss-HIDDEN impressions.** If the English gloss/blend was showing, the learner did not need to read the characters — that impression does not credit the pinyin/tone dimension.
- **Never credit a dimension the other scaffold leaked.** Each successful impression updates at most the dimensions whose scaffolds were *off*.

This makes the two latents genuinely independent estimators rather than two views of one inflated number.

### 2.4 The breathe-down-by-dimension click

A **click** (the click-any-word lookup) is a **failure signal**: the learner needed help. A click **"breathes" mastery DOWN** — it applies a negative update — and it charges that decrement to the **specific dimension whose affordance the learner actually opened**, never to the word as an undifferentiated whole. Because a word-level tap alone cannot distinguish a meaning failure (Latent W) from a per-character decoding failure (Latent C) from a tone failure, the lookup is built as **three separately-instrumented affordances inside the one word panel** (the DOM that carries them is specified in §8.2):

- opening the **meaning** affordance (the gloss/sense pane) breathes **Latent W** down for that `(word, reading)`;
- opening a **per-character segment** node (one tap target per character in the breakdown, each bound to that character's `(user, character)` key) breathes **that character's Latent C** down and surfaces the segmental-pinyin dimension — so a tap into 行 within 銀行 charges the *reading of the specific glyph the learner expanded*, not the whole word;
- activating the **tone cue / TTS** control breathes the **tone sub-track** down.

Attribution is charged **only** to the affordance the learner opened. If the learner taps the word but consumes no single dimension unambiguously — e.g. a bare word-level tap that opens the panel without drilling into any pane — the system applies **no per-dimension breathe-down** (at most a soft word-level review nudge) rather than smearing blame across all three latents. Crediting the *wrong* latent is worse than crediting none, so ambiguous interactions default to no-attribution.

"Breathe down" is deliberate: a single click is a soft decrement (it pulls R / P(known) down and reschedules sooner), not a hard reset to zero — the learner gets the word back into review rotation without losing all accrued history.

### 2.5 The unscaffolded integrated probe (readiness gate)

High W and high C, accrued on impressions that were each *individually* leak-free, still do **not** by themselves declare reading readiness — because the learner may never have read meaning **and** sound **and** tone **together, in context, with every scaffold off**. Before declaring a `(word, reading)` (or, at the curriculum level, a unit) **read-ready**, the model **REQUIRES an unscaffolded integrated probe**: an impression with **both scaffolds off** (no pinyin, no gloss) **and tone unsupported**, **in running context** (not isolation), that the learner clears. This is the only evidence that certifies the integrated reading skill the product's north star names. Passing the integrated probe is what flips the unit from "scaffolded-known" to "read-ready"; failing it breathes the contributing latents down and re-enters the item into the novelty-budgeted review weave.

### 2.6 Relation to production

Reading mastery (W and C as described) is **distinct from productive mastery**. Productive successes — pinyin-IME composition and cloze (§9) — update a **separate, down-weighted productive state**, never W or C directly, so that the act of *producing* a word does not over-fade the *reading* scaffold. The two-latent reading model is the source of truth for the blend, the fade, the breakdown panel, and TTS selection; production reads from it but writes only to its own state.

---

## 3. The three-fade ladder & the two pinyin layers

Reading readiness is reached by independently fading three scaffolds over the two coupled latent states (Latent W: per-`(user, word, reading)` FSRS recall; Latent C: per-`(user, character)` pyBKT recognition). The three dimensions fade on different clocks and against different latents; conflating them is the failure mode this section closes.

### 3.1 The three fade dimensions

1. **Meaning recognition (the blend) — gated by Latent W.** When `R` for a `(word, reading)` is low, the word renders as its English content morpheme in the inline base text (§3.6); as `R → 0.8` the Traditional glyph replaces the English. This is the meaning-blend dimension, keyed on the FSRS word/reading state, not the character.
2. **Segmental pinyin — gated by Latent C.** The romanized syllable body (initial + final, minus tone) shown in the ruby band fades as the *character's* `P(known)` rises. The gate is per-character, not per-word, because **an opaque glyph has no sound-it-out fallback**: an unmastered character inside an otherwise-mastered word still needs its segmental scaffold. Fading segmental pinyin on word mastery would strand the learner on the first glyph they meet in a new word.
3. **Tone — its own sub-track, faded LAST.** Tone is decoupled from the segmental body and fades after both meaning and segmentals, still mastery-gated and **actively retrieved** (§3.5). Tone is never a passive crutch left standing "for safety" — a passive tone mark fossilizes Tone-3 and must be retired by retrieval, not left to decay.

Credit assignment across these dimensions follows the leak rule of §2.3: meaning evidence is collected only on **pinyin-hidden** impressions, pronunciation evidence only on **gloss-hidden** impressions. A click "breathes" the relevant latent **down** and records which dimension failed (meaning / segment / tone) via the per-dimension affordances of §2.4. Reading readiness is declared only after an **unscaffolded integrated probe** (§2.5) passes.

### 3.2 The two pinyin layers

There is no single canonical pinyin string per word. The store carries two distinct layers, because the form used for *accounting* and the form used for *display/audio* diverge under sandhi:

- **citation-pinyin** — stored per word **and** per character; the dictionary/isolation reading (你好 = `nǐ hǎo`, `ni3 hao3`). Drives the **"known" accounting** (the FSRS unit and the Latent-C character unit) and the **click-breakdown panel** (the per-character meaning + reading the learner sees on tap). Citation-pinyin is what the gate's deterministic leg checks for *membership* (CC-CEDICT Traditional field + Unihan `kMandarin` candidate set must contain it), because dictionaries store the citation reading.
- **surface-pinyin** — stored per **occurrence**, with sandhi, neutral tone, and erhua resolved **in the sentence** (你好 spoken `ní hǎo`, `ni2 hao3`). Drives **what is rendered above the glyph** in the ruby band **and** what TTS speaks. The surface form is *not* a dictionary entry — `ní` is not a listed reading of 你 — so it is **never** checked against dictionary membership; its correctness is established by g2pW base-reading agreement plus the rule-based sandhi resolver's explicit word-grouping (§3.4). It is the *only* layer the SSML phoneme override and the per-engine tone-digit adapter consume.

The two layers are first-class, separately stored tuple slots (`citation_pinyin`, `surface_pinyin`), each NFC-normalized and stored as **tone marks, not digits** (a per-engine tone-digit adapter renders digits for TTS at the boundary). The surface tuple has dedicated slots for **neutral tone** and **erhua**, because 兒 fuses into the preceding syllable (花兒 → `huār`) and breaks 1:1 character↔pinyin alignment — there is no clean per-glyph ruby for the fused syllable, so the slot, not the alignment, carries it.

### 3.3 Fade-by-subtraction operates on the surface layer

Fade is **subtraction on the surface layer only**. The ruby band always renders `surface_pinyin`; fading removes it (by opacity, never `display:none` — the ruby band height is reserved so breathing causes no reflow, see §8). Citation-pinyin is never subtracted from anything the learner reads in context — it lives in the accounting and the click-breakdown, both of which are off the running-prose display path. This keeps the displayed sound correct (sandhi-resolved) at every fade level while the accounting stays on the stable citation form.

### 3.4 In-sentence resolution: sandhi, neutral tone, erhua, 不/一, and 3rd-tone grouping

Surface-pinyin is resolved **in the sentence**, never in isolation, because a stack of third tones has **no single deterministic surface form out of context**. Resolution is **two-stage**, and the two stages do different jobs:

- **(a) g2pW** (context-aware) first disambiguates the **base reading** at each heteronym position — is 行 here `xíng` or `háng`? g2pW is a polyphone/heteronym model; it picks the in-context *reading*. It does **not** compute sandhi.
- **(b) A rule-based sandhi/neutral-tone/erhua resolver** (built on pypinyin's `tone_sandhi` plus custom `不/一`, erhua-fusion, and neutral-tone rules) then applies the occurrence-level transforms *on top of* those base readings. Sandhi, neutral tone, `不/一` shift, and erhua fusion are regular phonological rules applied **after** reading selection — they are this resolver's job, not g2pW's.

The two-stage pipeline is a fixed stage of the generation order (§5: segment → disambiguate base reading → apply sandhi resolver → gate). What the resolver produces:

- **Tone-3 sandhi with explicit word-grouping.** For 3+ stacked third tones the surface form depends on syntactic grouping (你想買 groups as `[你][想買]` vs `[你想][買]`, yielding different sandhi). The sandhi resolver emits an **explicit word-grouping** alongside the surface string, and the gate verifies the surface form *against that grouping* — a surface tone with no grouping for a 3+ third-tone run is a gate failure, not a pass.
- **不 / 一 tone shifts** are resolved here (不 → `bú` before a 4th tone; 一 → `yì`/`yí` by following tone), as occurrence-level surface facts, not lexical.
- **Neutral tone and erhua** fill their dedicated tuple slots (§3.2); erhua's syllable fusion is carried by the slot since it has no 1:1 ruby alignment.

The gate then verifies that **grouped surface form**, and verification splits cleanly by layer. The deterministic membership leg (CC-CEDICT Traditional field + Unihan `kMandarin`) checks **only citation-pinyin** — per word and per character — because dictionaries store **citation** tone and a sandhi surface tone (你好 → `ní hǎo`: `ní` is *not* a listed reading of 你) is absent from every dictionary; membership-checking the surface form would RED-fail the exact sandhi case this two-layer model exists to handle, withholding correct text. **Surface** correctness is instead established by (a) the neural-agreement leg requiring **g2pW to agree on the in-sentence base reading** at each heteronym position and (b) the deterministic sandhi resolver's **explicit word-grouping** — never by dictionary membership. Boundary disagreement among the segmenters (the AS/CKIP-configured HanLP default + jieba/pkuseg voters, normalized to the AS standard first) **downgrades the band** (GREEN→YELLOW), which suppresses that word's fade and posts a margin note — the learner keeps a scaffold rather than risking a wrong surface form.

### 3.5 The character-borne tone cue for the late tone state

Tone fades last, but the late "tone-kept-longest" state **cannot** be rendered as a diacritic-on-letter pinyin mark: once the segmental pinyin has faded by subtraction, **there is no vowel letter left for the tone diacritic to sit on** — a tone mark cannot outlive its vowel. The locked solution: the late tone state is a **character-borne tone cue** painted on the glyph itself (tone color or a contour mark on the Han character), colorblind-safe, explicitly taught and gate-verified like any other displayed target byte.

The tone ladder therefore has two rendered states plus the north star:

1. **Early:** diacritic-on-letter pinyin ruby (tone lives on the romanized vowel in the reserved ruby band).
2. **Late:** segmental pinyin gone; tone survives as a **character-borne cue** on the glyph (color/contour, colorblind-safe).
3. **North star:** both vanish — the unannotated Traditional glyph, read with correct Putonghua tone from memory.

The character-borne cue is still **mastery-gated and actively retrieved** — it is retired by passing tone retrieval, not left standing. The colorblind-safe contour encoding (not color alone) is the accessible default.

### 3.6 The blend renders as an inline base-text swap

The meaning-blend dimension (§3.1, dim 1) renders as an **inline base-text swap**: the unmastered word's English content morpheme appears **in place of** the Han glyph in the running base text — not as a second `rt` above it. This is locked for two reasons: a second ruby line would make the screen reader double-read (glyph + gloss), and a gloss `rt` would collide with the app's own click-to-TTS channel. The English fills the base-text run; the ruby band above it carries only `surface_pinyin` (which fades on the Latent-C clock, independently of the meaning swap on the Latent-W clock). As `R → 0.8` the swap reverts to the verified Traditional glyph. Because Chinese is the Matrix Language (word order + all system morphemes) and English supplies content morphemes only (§4), the swap is a deterministic in-place substitution of a single content word, never a reflow of the clause.

---

## 4. The blend: generate-then-anglicize-DOWN

### 4.1 Direction is locked: generate verified Traditional, then subtract

The blend runs in exactly one direction: **generate fully-formed, verified Traditional Chinese first, then anglicize *down* the unmastered words by subtraction.** We never generate "mixed" text directly, and we never translate English *up* into Chinese on the display path. This is the only verifiable direction, and the choice is load-bearing rather than stylistic.

The reason is the product's core constraint: neither learner nor operator can read Chinese, so every target-language byte must clear the gate (§6) before display. If the LLM emitted a code-switched string directly, the English islands would fragment the Chinese, and the gate's deterministic legs (CC-CEDICT Traditional-field membership, Unihan `kMandarin` candidate-set, g2pW in-sentence agreement, CKIP/HanLP segmentation) would have nothing coherent to check — segmentation and surface-pinyin resolution both depend on an intact Chinese sentence. By contrast, a *complete* Chinese sentence is verifiable: it segments, its surface-pinyin resolves in-sentence, and the gate bands it green/yellow/red. Anglicization then operates on that already-verified structure by **removing** Chinese, which can only ever *reduce* the target-language surface a learner sees. Subtraction cannot introduce an unverified Chinese byte; it can only blank a verified one and substitute an English word the learner already knows. That asymmetry — adding English is safe, adding Chinese is not — is why the direction is fixed.

**Data flow (the blend's slice of the generation pipeline; the full ordering is §5, and authentic un-generated text takes the separate path of §5.4):**

```
generate verified Traditional sentence
  → segment (AS/CKIP-standard boundaries)          ← click-unit == FSRS unit
  → resolve surface-pinyin in-sentence (g2pW base reading → sandhi resolver)
  → GATE (deterministic-first + jury → green/yellow/red bands)
  → ANGLICIZE-DOWN unmastered words by deterministic subtraction   ← this section
  → render fade
  → TTS from verified SURFACE pinyin
```

Anglicization sits strictly *after* the gate. A word is only a candidate for replacement once its tuple is verified; the decision to *keep it Chinese or swap it to English* is then driven by Latent W (target R ≈ 0.8). A word below threshold is anglicized down; a word at or above threshold stays Chinese. Because the meaning blend renders as an **inline base-text swap** (the English word standing in place of the glyph, not a second `rt` — §8), anglicizing a word is literally substituting its verified `gloss` for its glyph in the rendered base text. Nothing un-verified is ever introduced by this step.

### 4.2 The Matrix-Language Frame: Chinese matrix, English content-only

The blend is governed by the **Matrix-Language-Frame model**, locked as follows:

- **Chinese is the Matrix Language.** It supplies the morphosyntactic frame of every sentence: **word order** and **all system morphemes** (function words, particles, classifiers, aspect, structural complements — the never-anglicize allowlist in §4.4).
- **English is the Embedded Language, and contributes content morphemes only.** English may surface as a **bare content word** — a noun, a verb stem, a predicate adjective — slotted into a Chinese frame. English never contributes word order, never contributes a function word, and never restructures the clause.

Concretely, "她很 pretty" is legal (English adjective embedded in a Chinese predicate-adjective frame, degree filler 很 retained); "she is pretty" is not, because that would import English word order and the English copula. The frame stays Chinese at every fade level; only the *content* slots breathe between Chinese and English as Latent W rises. This keeps the learner reading **Chinese grammar** the entire time — the thing being scaffolded is comprehension of the content words, not the syntax, which is acquired implicitly by always-present structure.

### 4.3 The deterministic anglicization transforms

Anglicization-down is performed by **deterministic transforms, not LLM judgment.** The LLM's only generative role already happened upstream (producing the verified Chinese); the subtraction step is a fixed rule set so its output is reproducible and auditable without a Chinese-literate operator. When an unmastered content word is selected for replacement, it is rewritten by its part-of-speech rule:

- **Inserted English nouns stay bare and singular.** No plural -s, no article. Chinese supplies number and definiteness via the frame (classifier + numeral), so the English noun is a bare lexeme: **"three 本 book"** — the classifier 本 and the numeral stay Chinese; only "book" is English, and it is *not* pluralized to "books." Pluralizing it would teach English morphology the Chinese frame does not have.
- **Inserted English verbs stay bare-stem.** No tense, no agreement, no -s/-ed/-ing. Chinese carries aspect with its own morphemes, which are never anglicized: **"eat 了"** — the perfective 了 stays Chinese and does the aspectual work; "eat" is the bare stem. "ate 了" or "eats 了" would double-mark and teach a false equivalence between English tense and Chinese aspect.
- **Predicate adjectives keep the degree filler, never the copula.** A Chinese predicate adjective takes a degree adverb (very/quite) as a filler, not 是. So the embedded English adjective is rendered **"她很 pretty"** — degree filler 很 retained, **never** 是 inserted. Importing "is" would teach learners to (wrongly) use 是 with adjectives, one of the most common L1-English errors in Chinese.
- **Negation is aspect/verb-type-selected, supplied by the frame.** Chinese chooses between 沒 (perfective/existential negation) and 不 (general/habitual/modal negation) by the verb and aspect — a distinction English collapses into "not/didn't." Negation is therefore **always a Chinese system morpheme**, selected by the frame and never anglicized: the correct 沒 vs 不 is emitted with the Chinese structure, and the English content word slots in negated by the Chinese particle, not by an English "not."

Each transform is a pure function of (part-of-speech tag from the canonical segmenter, the verified tuple). It never invents a Chinese byte and never alters the frame.

### 4.4 The never-anglicize allowlist (system morphemes)

The following are **system morphemes and stay Chinese at every fade level.** They are the Matrix Language's grammatical skeleton; anglicizing any of them would either import English structure or destroy a Chinese construction the learner must read. This list is **closed and enforced** — a word tagged as belonging to any class below is exempt from the subtraction step regardless of its Latent W.

- **Classifiers / measure words** (本, 個, 隻, 張 …). Obligatory between numeral and noun, no English equivalent; "three book" without 本 is ungrammatical Chinese.
- **Aspect markers 了 / 著 / 過.** Perfective, durative, experiential. These carry the temporal information English would put in verb tense; they must stay Chinese precisely because the embedded English verb is bare-stem (§4.3).
- **Resultative and directional complements**, including the **得 / 不 potential infix.** The potential construction (聽**得**懂 "can understand-by-hearing" / 聽**不**懂 "cannot") inserts 得/不 *inside* the verb-complement compound; there is no English content slot here, and breaking it would teach a non-construction.
- **離合詞 (separable / split verbs).** Verbs like 洗澡 ("bathe") split under aspect/measure insertion into a **discontinuous span**: 洗澡 → 洗**了個**澡. The two halves of the lexeme are no longer adjacent. These are flagged at segmentation (`lihezi_flag`) so the gate and the click-unit treat the discontinuous span as one FSRS word; anglicization is forbidden because there is no contiguous content morpheme to replace.
- **The 把 disposal frame.** 把 fronts the object before the verb and restructures the clause; it is pure syntax with no English analog.
- **The 是…的 focus / cleft bracket.** A discontinuous structural frame marking the focused element; both halves stay Chinese or the construction collapses.
- **的 / 地 / 得** (attributive / adverbial / complement-marking particles). Toneless structural particles, also members of the hand-pinned function-word heteronym head set the gate treats as ground truth.

The allowlist is enforced as a tag check on the segmented, verified tuple *before* the part-of-speech transform runs: if a token carries a system-morpheme class (or `lihezi_flag`), it is skipped. Because the allowlist overlaps the hand-pinned function-word heteronym head set (的/地/得, 了, 不, 一, 著, 和 …), these tokens are doubly protected — exempt from anglicization *and* fixed in their reading by the gate, which matters because they are the first words a beginner meets and the highest-density source of heteronym error.

### 4.5 Structurally safer than Arabic — but not a shorter special-case list

The blend is **structurally safer** than the Arabic baseline, and the reason is typological: Chinese is **isolating / analytic.** There is no inflectional morphology to fail on — no gender or number agreement, no case, no person/number verb conjugation, no attached clitics or pronominal suffixes to keep concordant when an English word displaces a Chinese one. Inserting a bare English noun or verb into a Chinese frame cannot break agreement *because there is no agreement to break.* That is why the Arabic morphological analyzer is **not ported** (§10.6): there is no inflectional analysis step on the Chinese path at all.

**This does not make the special-case list shorter — it relocates the verification budget.** Arabic spent its budget on agreement-checking (gender/number/case concord across the inserted island). Chinese spends an equal or larger budget elsewhere:

- **Segmentation** is the word-unit analog of Arabic diacritization ambiguity, and it is *inside* the gate, not a preprocessing nicety. The click-unit must equal the FSRS unit, so one canonical segmentation standard (Academia Sinica / CKIP) is pinned end-to-end, produced by an AS-configured HanLP default with jieba/pkuseg voters normalized to that standard before agreement is scored (§6.7); post-normalization boundary disagreement downgrades the band. Anglicization operates on segments; a wrong boundary anglicizes the wrong span.
- **Tone and heteronym resolution** (the citation/surface two-layer pinyin problem, 3rd-tone sandhi grouping, 不/一 shifts, function-word heteronyms) is a verification cost Arabic did not have in this form.
- **離合詞 discontinuous spans** and the **得/不 potential infix** are construction-level special cases with no Arabic counterpart — a Chinese-specific exemption list the never-anglicize allowlist must carry.

So the engineering claim is precise: the blend is *safer* (subtraction cannot mint an unverified byte, and the isolating typology removes a whole class of agreement failures), but the special-case surface is **comparable in size and merely shifted** — out of agreement-checking and into segmentation, tone, and heteronym verification. Anyone budgeting verification effort from the Arabic baseline should move that budget, not delete it.

---

## 5. The generation & ingestion pipelines and their ordering

This section specifies the fixed order in which target-language bytes are produced (or ingested), transformed, verified, and rendered. The ordering is **load-bearing, not stylistic**: each stage consumes a representation the previous stage has already constrained, and the gate sits at the single point where every byte that will ever reach the learner is provably a real, correct word. Nothing reaches display except through a pipeline that passes the gate; there is no side channel. There are **two** pipelines that share the gate and the tuple store: the **generation pipeline** (§5.1, for tutor-authored text) and the **authentic-reading ingestion pipeline** (§5.4, for the un-generated north-star text the learner reads).

### 5.1 End-to-end stage order — generation (LOCKED)

The hot path for one tutor turn runs these stages in this order:

1. **Generate verified Traditional.** The LLM generates target text **directly in Traditional-script Standard Written Chinese** — Taiwan/HK/Macau publishing register, Putonghua readings. We generate Traditional first and anglicize *down* (§4); we never generate English and translate *up*, because up-translation is the unverifiable direction. Generation is constrained by the per-turn novelty budget (≤3 novel items across meaning/pinyin/tone/structure, never 2 novel in one clause) and by the learner's two latent states (W for the meaning blend, C for the pinyin fade).
2. **S→T-normalize sources — UPSTREAM ONLY.** Any source material that arrives in Simplified (corpus excerpts, dictionary back-references, a model that emitted Simplified) is converted Traditional via **OpenCC**, but **only off the display path**, during corpus/source preparation. OpenCC output is **untrusted data** (the S→T many-to-one hazard — `发→{發 fa1, 髮 fa4}`, `干→{干, 乾, 幹}` — silently injects wrong-but-real glyphs) and therefore re-enters the per-word gate at stage 5 like any other candidate byte. **No OpenCC output is ever S→T-converted on the live render path.**
3. **Segment (cí boundaries).** The Traditional string is segmented into words against **one pinned standard end-to-end (Academia Sinica / CKIP)**, so the click-unit equals the FSRS unit equals the gate unit. The default segmenter is a **HanLP model configured to emit the AS/CKIP standard** — HanLP's stock Mainland models follow CTB/MSR/PKU, a *different* standard, so the AS-targeting configuration is load-bearing, not incidental. **jieba** and **pkuseg** run as voters, but their boundaries are first **normalized/mapped to the pinned AS standard**, so a vote counts as disagreement only when the cut genuinely differs — not when the voter merely follows a different segmentation convention. Boundary disagreement *after normalization* does not stop the pipeline — it **downgrades the band** at stage 5. (CKIP-Transformers is the AS-standard reference implementation and MAY replace the configured HanLP as the standard-defining segmenter under the recorded GPL decision of §10.5; v1 ships on the AS-configured HanLP so GPL adoption is never a launch blocker.) The `離合詞` flag permits discontinuous spans (`洗澡 → 洗了個澡`) so a separable verb is one FSRS unit across a gap.
4. **Resolve surface-pinyin in-sentence (two-stage).** For each segmented word we resolve the **surface** pinyin layer — sandhi, neutral tone, and erhua applied *in this sentence* — distinct from the stored **citation** pinyin. This is two distinct steps: **(4a) g2pW** (context-aware) disambiguates the **base reading** at each heteronym position — it is a polyphone/heteronym model that picks `行` as `xíng` vs `háng` in context; it does **not** compute sandhi; **(4b) a rule-based sandhi/neutral-tone/erhua resolver** (built on pypinyin's `tone_sandhi` plus custom `不/一`, erhua-fusion, and neutral-tone rules) then applies the occurrence-level transforms on top of those base readings — Tone-3 sandhi with the **explicit word-grouping** for 3+-stacked third-tone runs, `不/一` tone shifts, neutral tone, and erhua fusion (`兒` collapsing into the preceding syllable, breaking 1:1 char↔pinyin alignment) — writing into the tuple's first-class neutral-tone and erhua slots. The grouped surface form is what will sit above the glyph and what TTS will speak; citation-pinyin drives the click-breakdown and the "known" accounting.
5. **GATE (multi-leg, deterministic-first).** Every word — its stored reading, its in-sentence surface-pinyin, its segmentation — passes the gate of §6: deterministic membership (CC-CEDICT Traditional field + Unihan `kMandarin` candidate-set must *contain* the **citation** reading, after variant→MOE-canonical normalization + NFC), neural agreement (g2pW must agree on the in-sentence **base** reading), and the diverse-vendor LLM refutation jury (majority, **downgrade-only**). The **grouped surface form** is verified by g2pW base-reading agreement plus the sandhi resolver's word-grouping (§3.4) — **never by dictionary membership**. The gate emits a band per word: **GREEN** (show normally), **YELLOW** (show, but suppress that word's fade and attach a margin note), **RED** (**WITHHOLD**). The learner **never sees red**.
6. **Anglicize-down unmastered + render fade.** Only **after** the bytes are gate-cleared do the display transforms run. Unmastered words are anglicized down by deterministic subtraction (Chinese as Matrix Language; English as embedded content morphemes only — never the never-anglicize system-morpheme allowlist). The three fade dimensions are applied by subtraction on the **surface** layer: meaning blend (Latent W), segmental pinyin (gated by Latent C), and tone (own sub-track, faded last, actively retrieved). Fade is `rt` opacity over a reserved ruby band — never `display:none` — so breathing causes no reflow.
7. **TTS from verified SURFACE pinyin.** Audio is synthesized from the **gate-verified surface-pinyin string, never from raw characters.** **Azure** (zh-CN Putonghua neural) is primary, driven via SSML `<phoneme alphabet="sapi">` overrides + Custom Lexicon pinning so the engine's own g2p is bypassed for every overridden syllable; **Google zh-CN** and **Amazon Polly (Zhiyu)** are redundant engines. A per-engine tone-digit adapter converts the tuple's stored tone *marks* into each engine's expected tone *digits*.

The invariant across all seven stages: **the gate (stage 5) is the only authority on whether a byte is correct, and every display or audio transform (stages 6–7) consumes only gate-cleared, post-resolution surface forms.** S→T conversion is upstream-only and re-gated; segmentation and surface-pinyin are resolved *before* the gate so the gate verifies the exact form that will render.

### 5.2 Oversample-and-rank (N = 3–5)

Generation at stage 1 is **oversample-and-rank**, not single-shot. The LLM produces **N = 3–5 candidate continuations** for the turn. Each candidate is scored against the **per-turn budget** — novelty-budget conformance (≤3 novel items, no 2-novel clause), FSRS-due-review coverage (weaving due Latent-W items into prose as the flashcard-free review), word- and character-coverage floors (98%/95% comprehension; the separate character-decoding-load floor), and register fit. **The highest-scoring candidate is kept; the rest are discarded.**

Candidates are scored *before* the expensive gate legs where possible: cheap deterministic checks (coverage, novelty, segmentation cleanliness) rank the N candidates first, and only the **winning** candidate pays the full per-word gate. A candidate that cannot clear the gate (any RED that cannot be repaired by substituting a known-good cached word) is dropped and the next-ranked candidate is promoted, so oversampling also buys **gate-failure resilience** without a regeneration round-trip.

### 5.3 Hot path vs. offline — cache granularity

Verification cost is split by **cache granularity**, so the learner-facing turn stays fast without pretending per-occurrence work is free:

- **The citation layer is cached by `(word, reading_id)` and reused free.** Citation-pinyin, the per-character citation readings, gloss, `reading_id`, `freq_rank`, the bound/`lihezi` flags, and the Latent W/C mastery keys are lemma-scoped — they do not change between sentences — so once a `(word, reading_id)` tuple is verified GREEN these fields are read straight from the store with **no gate legs re-run**.
- **The surface layer is keyed by `(word, reading_id, in-sentence context)` and is a cache miss on most occurrences.** `surface_pinyin` is occurrence-scoped (sandhi/neutral-tone/erhua depend on the neighbours), so the *same* lemma in a *new* sentence is a new surface key. That miss re-runs the **cheap** legs **hot**: deterministic citation-membership (a dictionary lookup), g2pW base-reading agreement, the rule-based sandhi resolver, and the segmenter vote. These run inline in the Python sidecar and are fast — but the point is honest: a hot turn **does** pay per-occurrence surface deterministic + g2pW + segmenter legs on most words. That cost is real and budgeted, not zero.
- **Only the jury is amortized.** The costly leg — the diverse-vendor LLM refutation jury — is the one thing run **OFFLINE at pre-generation**, so the frequency-ranked tuple table arrives already banded. The jury is **hot only on an explicit flag**: a never-before-seen tuple, a surface grouping the resolver has never produced before, an S→T-derived byte, an authentic-reading or learner-writing token the cache has never seen, or a low-frequency transient the learner just clicked. The accurate summary: a hot turn runs **zero jury calls** in the common case but still pays the cheap deterministic + g2pW + segmenter legs for every new surface occurrence.

**Error handling on the hot path:** a stage-5 **RED** never blocks the turn — the pipeline substitutes a known-good cached word or falls back to English for that span, and the turn proceeds. A **YELLOW** shows the word but suppresses its fade and attaches the margin note, so a still-uncertain byte is never treated as mastered. A cache miss on a tuple the turn needs triggers the flagged hot-path verification for that one tuple only; a hard sidecar failure degrades that span to English rather than rendering an unverified glyph. **No unverified target byte ever reaches the learner**, on any path.

### 5.4 The authentic-reading ingestion pipeline (the north star)

The §5.1 pipeline generates text; the product's **north star is reading authentic, un-generated Traditional text** (§1.1) — books, periodicals, signage the learner brings or the curriculum sources. Authentic text is also one of the **two non-generated surfaces** segmentation is load-bearing on (§6.7; the other is learner writing, §9). It runs its own pipeline, sharing the gate and the tuple store but with **no generation stage and no anglicize-down step** — we cannot rewrite an author's sentence:

1. **NFC-normalize** the incoming passage. If the source is Simplified, S→T-convert it with OpenCC **upstream, off the display path**, and treat every converted byte as untrusted data that must clear the gate (§6.6), exactly as for generated text.
2. **Segment** against the pinned AS/CKIP standard (the AS-configured HanLP default + normalized jieba/pkuseg voters), so the click-unit equals the FSRS unit on authentic text too.
3. **Resolve surface-pinyin in-sentence** — the same two-stage resolution as §5.1 stage 4 (g2pW base reading → rule-based sandhi resolver with explicit word-grouping).
4. **GATE per word** — the same multi-leg gate and the same GREEN/YELLOW/RED bands (deterministic citation-membership + g2pW base-reading agreement + jury). Because authentic passages are mostly cache-miss tuples on first encounter, the jury runs here far more often than on generated turns (it is one of the §5.3 hot-flag cases), so authentic passages are **pre-processed ahead of a reading session**, not resolved live keystroke-by-keystroke.
5. **Attach tuple gloss + per-character breakdown** from the verified tuple store; a never-seen word mints a new tuple once it clears the gate.
6. **Render ruby + apply per-learner fade** — the learner's own Latent W / Latent C / tone state drives the blend and the three fades over the author's fixed words.

**RED handling differs fundamentally from generation.** On a generated turn a RED word is *substituted* with a known-good cached word or dropped to English (§5.3) — the source is ours to alter. On **authentic** input the source is **fixed and may not be altered**: silently swapping a word would misrepresent the text the learner is reading. A RED on authentic input is therefore handled by **scaffold-up, not substitution** — it is annotated as a **transient** (§7.5): shown with full scaffold (pinyin + gloss + margin note) and excluded from mastery accounting and the coverage-floor denominators. When even the deterministic floor cannot certify a reading, the token is surfaced as an **explicitly-flagged unresolved item** ("we can't verify this character's reading here") rather than a confidently-wrong gloss. The learner reads the real text; the system never fabricates a reading it cannot stand behind, and never edits the author.

---

## 6. The verification gate (the trust spine)

Neither the learner nor the operator can read Chinese, so the gate is the product, not a feature: **every target-language byte that reaches display passes this gate first.** A wrong byte does not error visibly — it silently teaches a different real word — so the gate is deterministic-first, multi-leg, and fails closed. The learner **never sees red.** This section is the LOCKED contract for how a candidate tuple earns a band.

### 6.0 Why verification is NOT easier than Arabic

Arabic's hard verification problem was diacritization ambiguity (one consonantal skeleton, many vowelings). Chinese removes that but introduces **two** analogous hazards that consume the same verification budget:

1. **Segmentation is the word-unit analog of Arabic diacritization ambiguity.** Unannotated text carries no word boundaries; `研究生命起源` cuts two valid ways (`研究/生命/起源` vs `研究生/命/...`). The cut decides the click-unit, the FSRS unit, and the gloss. Segmentation is therefore *inside* the gate, not a preprocessing convenience.
2. **S→T conversion injects wrong-but-real glyphs** (the **#2 danger**). `发→{發 fa1, 髮 fa4}`, `干→{干, 乾, 幹}`. A naive per-byte check passes a fully-formed, dictionary-valid character that is simply the wrong one for the context. There is no spelling error to catch — only a semantic one.

The budget shifts away from Arabic's agreement/clitic checking and toward **segmentation + tone/heteronym resolution + S→T disambiguation**. It is not a shorter problem.

### 6.1 Leg 1 — Deterministic membership (the floor; the only leg that can produce RED)

Inputs: the stored `(traditional_word, per_character, citation_pinyin, surface_pinyin, reading_id)`. Before any lookup, the word and every character are **variant→MOE-canonical normalized** (collapse Taiwan variant forms to the MOE 4808 canonical glyph) and **NFC-normalized**.

- **CC-CEDICT (Traditional field):** the candidate reading-set for the word, read from the *Traditional* headword field, must **CONTAIN** the stored citation reading.
- **Unihan `kMandarin`:** the per-character candidate-set must **CONTAIN** each stored per-character citation reading.

**Leg 1 checks citation-pinyin only.** Dictionaries store the *citation* reading; the in-sentence **surface** form (sandhi/neutral-tone/erhua) is deliberately **not** membership-checked here — a sandhi tone like 你好 → `ní hǎo` (`ní` is not a listed reading of 你) is correct yet absent from every dictionary, so membership-checking the surface form would wrongly RED a correct byte. Surface correctness is Leg 2's job (g2pW base-reading agreement) plus the deterministic sandhi resolver's explicit word-grouping (§3.4) — never this leg.

Membership proves a reading is **A** valid reading, never **THE** correct one — `行` is validly `xing2` AND `hang2`; `重` is `zhong4` AND `chong2`. Leg 1 alone cannot pick the in-sentence reading; it can only **reject** a citation reading that no authority lists. **A miss here is the only path to RED:** the byte is not provably real, so it is WITHHELD.

### 6.2 Leg 2 — Neural context agreement

**g2pW (Apache-2.0, context-aware)** runs over the full sentence and must **AGREE** with the stored in-sentence **base reading** at each heteronym position. g2pW resolves the disambiguation Leg 1 structurally cannot (`行` as `xing2` vs `hang2` *in this sentence*). It agrees on the *base reading* only; the **surface** tones layered on top (sandhi, `不/一`, neutral, erhua) come from the rule-based sandhi resolver (§3.4, §5.1 stage 4b), and the gate verifies that grouped surface form rather than asking g2pW to compute sandhi it does not model. Disagreement does not produce RED — it downgrades the band to YELLOW for that word (§6.5), because a single context model is not ground truth.

### 6.3 Leg 3 — Voter independence (engineered, not assumed)

Stacking correlated models buys nothing. **g2pW and g2pM share CPP training data and are correlated** — running both is near-one model. Real diversity is sourced across *architecture and data lineage*:

- **g2pW** — neural, context-aware (Leg 2).
- **pypinyin (MIT)** — dictionary/rule lookup, independent code path (and the host of the `tone_sandhi` surface resolver).
- **Unihan `kMandarin`** — the bound authority from Leg 1, reused as a voter.
- **A different-vendor LLM** — a fourth, architecturally orthogonal opinion (the jury, §6.4).

g2pM/g2pC are retained as architecture-diverse *tie-break* voters, never counted as independent of g2pW. A reading is "neural-agreed" only when the **uncorrelated** legs concur.

### 6.4 Leg 4 — Diverse-vendor refutation jury

A panel of LLMs **from distinct vendors** is prompted in **refutation frame**: *"Find the error in this word/reading/segmentation, or state there is none."* Refutation framing suppresses the sycophantic confirmation a "is this correct?" prompt invites. A **majority** gate decides. Critical constraint: **the jury can only DOWNGRADE a GREEN to YELLOW — it can never substitute for, or override, the deterministic floor.** The jury never promotes a RED, and it is never the thing that proves a byte real. Its job is to catch the contextually-wrong-but-dictionary-valid case (the S→T hazard, §6.6) that Leg 1 waves through.

### 6.5 The bands

| Band | Condition | Display action |
|---|---|---|
| **GREEN** | All legs pass: deterministic citation membership + g2pW base-reading agreement + jury finds no error | Show normally; fade, blend, click-breakdown, and TTS all active. |
| **YELLOW** | Deterministic floor passes, but **minor jury disagreement**, segmenter boundary disagreement after normalization (§6.7), or g2pW context disagreement | **Show the word**, but **suppress that word's fade** (no scaffold removal on an uncertain byte) and attach a **margin note**. The learner reads it; the system does not stake mastery on it. |
| **RED** | **Any deterministic-floor failure** (Leg 1 citation-membership miss after normalization) | **WITHHOLD** (generated text): substitute a known-good cached tuple of equivalent curriculum role, or **fall back to English**. On **authentic** input the source can't be altered, so RED is handled by scaffold-up / annotate-as-transient instead (§5.4). The byte never reaches the screen as an unverified glyph. |

The asymmetry is deliberate: neural/jury legs can only move GREEN↔YELLOW; only the deterministic floor moves anything to RED. The learner **never sees red.**

### 6.6 S→T quarantine (untrusted data re-enters the gate)

OpenCC (Apache-2.0) runs **upstream only, off the display path** (§5). Its output is **UNTRUSTED DATA**, not a verified byte. The many-to-one expansions (`发→{發, 髮}`, `干→{干, 乾, 幹}`) mean OpenCC can emit a real, well-formed, wrong glyph. Therefore every S→T-derived word **re-enters the per-word gate from §6.1** as if freshly generated — same citation-membership floor, same neural agreement, same jury. The jury (§6.4) is the leg specifically expected to catch the OpenCC wrong-but-real glyph, since Leg 1 cannot. No S→T output is ever trusted on the strength of having been "converted."

### 6.7 Segmentation agreement → band

One segmentation standard is pinned **end-to-end**: **Academia Sinica / CKIP**, so the click-unit equals the FSRS unit equals the gloss unit. Crucially, the pinned standard must actually be *produced*, not merely named — HanLP's stock models, jieba, and pkuseg are trained on Mainland standards (CTB/MSR/PKU), which cut many multi-character words differently, so running them raw against an AS reference would fire **false GREEN→YELLOW downgrades on most words**. Verification therefore runs **multi-segmenter against a single normalized standard**:

- **A HanLP model configured to the AS/CKIP standard (HanLP core is Apache-2.0)** is the DEFAULT, standard-defining segmenter. (CKIP-Transformers, GPL-3.0, is the AS reference implementation and MAY be adopted as the standard-defining segmenter under the recorded GPL decision of §10.5; until then the AS-configured HanLP defines the boundary.)
- **jieba and pkuseg are voters whose boundaries are first normalized/mapped to the pinned AS standard.** Only *after* that normalization is "agreement" scored, so a vote counts as disagreement when the cut genuinely differs — not when the voter merely followed a different convention.
- **Post-normalization boundary disagreement DOWNGRADES the band to YELLOW** (suppress fade, margin note) — it does not RED, because a contested boundary still yields readable real words.
- A **離合詞 (separable-verb) flag** licenses a **discontinuous span** (`洗澡 → 洗了個澡`), so an inserted aspect/measure word between the two halves is not mis-scored as a boundary failure.

Segmentation is load-bearing on **two non-generated surfaces** the gate must also serve: **authentic reading** (the north star — unannotated input we did not author, ingested via §5.4) and **learner writing** (§9). The same normalized segmenter-agreement check runs on both.

### 6.8 Hand-pinned ground-truth overrides

- **Function-word heteronym head set — gate-as-ground-truth.** A hand-pinned set — `的 / 地 / 得`, `了`, `不`, `一`, `行`, `重`, `著`, `和` — is treated as ground truth that **no model (g2pW, jury, or otherwise) may override.** These are the highest-frequency, highest-ambiguity tokens a beginner meets first; the danger is front-loaded, so the answer is hand-pinned, not inferred.
- **Numerals get their OWN verification rule.** Number→character generation emits wrong-but-real characters, so it runs a dedicated check rather than the generic word path. The curriculum-bound distinction is enforced here: **兩** (used before measure words and hundreds) vs **二** (digit/ordinal).
- **`bound | compositional` per-character gloss suppression.** A per-character flag marks transliteration/bound morphemes — `葡萄`, `沙發`, `咖啡`, `玻璃`. `葡` has no standalone meaning; emitting a per-character gloss would **teach a fake meaning**. The flag SUPPRESSES the per-character gloss in the click-breakdown panel while leaving the word-level gloss intact. This is a correctness gate on the breakdown surface, not a display nicety.

### 6.9 Ground truth without a Chinese-literate operator

All g2p tools are **Simplified-trained on the script side**, so their Traditional behavior is unproven by default. Two mechanisms supply ground truth:

- **Traditional eval slice:** a held-out, Traditional-script labeled set the gate's legs are measured against — the standing regression check that catches Simplified-trained drift on Traditional input.
- **Weekly sampled native-checker calibration:** a Chinese-literate native checker scores a weekly sample; agreement is tracked by **Cohen's κ ≥ 0.8**. A **one-time gold seed** bootstraps the slice. This human calibration loop is **the only source of ground truth** in a system whose operator cannot read the target language — it is what licenses trusting the automated bands at all.

### 6.10 Caching and where the expensive legs run

The verified tuple is the cached source of truth, cached at **two granularities** (§5.3): the **citation layer** is `(word, reading_id)`-keyed and reused with **no re-verification**; the **surface layer** is `(word, reading_id, in-sentence context)`-keyed, so a new occurrence re-runs the **cheap** legs (citation-membership, g2pW base-reading agreement, the sandhi resolver, the segmenter vote) **hot**. The one expensive leg — the **diverse-vendor jury** — runs **OFFLINE at pre-generation** and is **hot only on a flag** (a new word, an S→T-derived byte, a surface grouping never produced before, an authentic-reading or learner-writing token the cache has never seen). So the hot path skips the jury but still pays the per-occurrence surface deterministic legs; only the jury is amortized off the critical path.

---

## 7. The verified-tuple schema & the curriculum/selection service

This section specifies the persistent data record that every other subsystem reads from — the verified tuple — and the service that decides which tuples enter a given turn. Both are LOCKED. The tuple is the single source of truth for the meaning blend, the three fade dimensions, the click-breakdown panel, and TTS; the selection service is the only component allowed to introduce a novel item into the learner's stream, and it never bypasses the gate (§6).

### 7.1 The verified tuple (first-class cached store)

The verified tuple is the unit of caching, of FSRS scheduling (Latent W), and of the click target. It is keyed on the **word** (segmented per the pinned Academia Sinica/CKIP standard), and it embeds its constituent characters so that Latent C (per-character recognition) accrues from the same record. A tuple is written only after it passes the gate at GREEN or YELLOW; a RED form is never persisted as a usable tuple. All text fields are **NFC-normalized at write time** and re-normalized at render.

Fields (LOCKED):

| Field | Type | Purpose / mechanics |
|---|---|---|
| `traditional_word` | string (NFC) | The display form. MOE-canonical variant (§6 normalization applied before storage). |
| `simplified_word` | string (NFC) | **Stored now, displayed never (v1).** Persisted so a future "read Simplified too" ships as a display/ladder module on the *same* mastery state — not a re-verification pass. Off the display path in v1. |
| `per_character[]` | array | One entry per Traditional character, in surface order. Each carries: `char`, `citation_pinyin_char`, `compositional_bound_flag`, and the Latent C key `(user, character)`. The bound flag SUPPRESSES the per-character gloss for transliteration/bound morphemes (葡萄, 沙發, 咖啡, 玻璃 — 葡 has no standalone meaning; a per-char gloss there teaches a fake meaning). |
| `citation_pinyin` | string (tone MARKS) | Per-word canonical reading. Drives the "known" accounting (Latent W key), the click-breakdown panel (你好 → ni3 hao3, shown as nǐ hǎo), and **the deterministic membership leg** of the gate. |
| `surface_pinyin` | string (tone MARKS) | **Per-OCCURRENCE**, sandhi + neutral-tone + erhua resolved in-sentence (g2pW base reading → rule-based sandhi resolver, §3.4). Drives the ruby shown above the glyph AND the TTS input. Fade-by-subtraction operates on THIS layer (你好 spoken ni2 hao3 → ní hǎo). Stored against the occurrence, not the lemma; **never** membership-checked against a dictionary. |
| `neutral_tone_slots[]` / `erhua_slots[]` | structured | First-class slots, not string hacks. Erhua (兒) fuses into the preceding syllable, breaking 1:1 char↔pinyin alignment; the slot records the fusion so the mono-ruby renderer and the tone-digit TTS adapter stay correct. |
| `gloss` | string | English meaning. CC-CEDICT (CC BY-SA, flat slash-list, Mainland readings — correct for the locked Putonghua standard) as base; Kaikki/Wiktextract per-sense seed pinned to one frozen dump. |
| `reading_id` | id | The mastery key. v1 keys Latent W on **reading**, not fine-grained sense. 行 xíng vs háng are distinct `reading_id`s and distinct tuples. |
| `frozen_sense_id` | id (optional) | Set only when sense-splitting is enabled (a flagged upgrade, recorded deviation). Frozen against the pinned Wiktextract dump so sense IDs never drift. |
| `band` | enum {GREEN, YELLOW} | Gate verdict at write time. RED is never stored as usable. YELLOW carries the fade-suppression + margin-note obligation downstream. |
| `freq_rank` | int | Rank in the cleanroom-derived frequency table (§7.2). Drives the curriculum-fallback selector. |
| `variety_tag` | const `Putonghua` | The ONE global config binding (verification dictionary + TTS voice + displayed pinyin). Present on every tuple so no leg can silently mix a Taiwan-Guoyu reading (和 hàn, 垃圾 lèsè) into the Putonghua stream. |
| `bound_morpheme_flags` | bitset | Mirror of the per-character compositional/bound flags at the word level; gates whole-word gloss behavior for transliterations. |
| `lihezi_flag` | bool | Marks 離合詞 separable verbs (洗澡 → 洗了個澡). Permits a **discontinuous span** in segmentation and in the click target, and pins the word as a single FSRS unit even when split in the surface sentence. |

Tone is stored as **marks, not numbers**, with a per-engine tone-digit adapter applied only at the TTS boundary (Azure SSML `alphabet=sapi`, Google, Polly each consume their own digit form). Storing marks keeps the render path (HTML ruby) byte-identical to the gate's verified form.

**Cache discipline (two granularities).** The **citation layer** — `citation_pinyin`, the per-character citation readings, `gloss`, `reading_id`, `freq_rank`, the bound/`lihezi` flags, and the Latent W/C mastery keys — is cached by **`(word, reading_id)`** and reused with **no gate legs re-run**, because none of it varies between sentences. The **surface layer** — `surface_pinyin` and its neutral-tone/erhua slots — is cached by **`(word, reading_id, in-sentence context)`**; it is occurrence-scoped, so the same lemma in a new sentence is a **cache miss** that re-resolves the surface form and **re-gates it in-sentence** (§6) by re-running the **cheap** legs hot — deterministic citation-membership, g2pW base-reading agreement, the sandhi resolver, and the segmenter vote. Only the expensive diverse-vendor jury is amortized **OFFLINE at pre-generation** and stays hot only behind an explicit flag. Hot turns therefore do pay per-occurrence surface deterministic + g2pW + segmenter legs; what they skip is the jury.

### 7.2 The cleanroom curriculum (word spine, glyph standard, frequency)

No single list is Traditional-native AND Taiwan-register AND open-licensed AND frequency-ranked, so the frequency-ranked tuple table is **cleanroom-derived**. The sources, each in a fixed role:

- **Word spine — TOCFL / SC-TOP 8000 (LOCKED primary).** Traditional-native, Taiwan-register, CEFR-banded; entries already ship Traditional + pinyin + English. This is the vocabulary backbone the selection service draws new words from.
- **Glyph standard — MOE 4808 common-character set.** The canonical Traditional GLYPH authority and the source of commonality tiers for the **character-coverage floor** and the ~1000-character front-load (§7.3). Character identity and the Latent C inventory are defined here, not by the word list.
- **Frequency — Academia Sinica (Sinica) Balanced Corpus.** Frequency rank (`freq_rank`) is built from Sinica, **NOT** from Simplified SUBTLEX or Jun Da — those encode Mainland register and Simplified tokenization. This is the cleanroom step.
- **HSK 3.0 L1–3 — coarse beginner prior ONLY**, used only where it overlaps the spine, Taiwan-filtered, and **never displayed**. It nudges early ordering; it is not a source of displayed bytes.

**Known tradeoff (covered by the onboarding honesty note, §1.2):** Taiwan-register VOCABULARY is read with Putonghua PRONUNCIATION (垃圾 taught lā jī though Taiwan says lèsè). This is the deliberate north-star compromise — Traditional script, Taiwan vocabulary, Mainland reading — not a bug.

**Numerals** get their own curriculum rule (number→character generation emits wrong-but-real characters, §6.8): teach 兩 (before measure words / hundreds) vs 二 (digit / ordinal) explicitly, as scheduled curriculum items rather than letting the generator improvise.

### 7.3 Dual coverage floors

Two independent floors, gating two different things. They are NOT collapsed into one number, because comprehension and decoding load are different latents.

- **Word-coverage comprehension floor — 98% default / 95% named stretch.** Computed over running text against the learner's mastered-word set (Latent W ≥ target R ≈ 0.8). Gates **whether a turn's prose is comprehensible** — selection must keep ≥98% of word tokens within the known/blended set, or anglicize-down the remainder. Rare topic words are excluded as transients (§7.5) so they don't drag the floor.
- **Character-coverage decoding-load floor.** Computed over characters against Latent C (per-character P(known), pyBKT). Gates **the pinyin fade and the unscaffolded integrated-probe readiness** — an opaque glyph has no sound-it-out fallback, so segmental pinyin fades on CHARACTER recognition, not word mastery. A sentence can clear the word floor while failing the character floor (a known word containing a not-yet-recognized glyph); in that case the word stays, but its pinyin scaffold is RETAINED.

**Front-load:** the ~1000 highest-frequency Traditional characters (≈90% running-text coverage, ranked by Sinica frequency within the MOE 4808 inventory) are prioritized into Latent C early, so the character floor rises fast enough to unblock the pinyin fade.

### 7.4 The per-turn priority cascade

Each turn, the selection service fills the turn's content under the shared novelty budget by walking a fixed cascade. It stops as soon as the budget and coverage floors are satisfied:

1. **FSRS-due reviews first.** Tuples whose Latent W schedule (FSRS, R ≈ 0.8) makes them due are woven into the prose as the review session — there are NO flashcards; review is in-context reading. Due reviews have priority over any new material.
2. **Topic-in-band new word.** If budget remains, introduce a new word that is (a) on-topic for the current conversation, (b) within the TOCFL/SC-TOP band the learner is at, and (c) passes the gate GREEN/YELLOW. This is the preferred source of novelty because it is contextually motivated.
3. **Curriculum fallback.** If no topic-appropriate in-band new word exists, fall back to the next item by `freq_rank` from the cleanroom curriculum table. This guarantees forward progress even in topics with thin in-band vocabulary.

Every candidate at steps 2–3 passes §6 before display; a RED candidate is dropped and the cascade continues (substitute a known-good cached word or fall back to English, never show RED).

### 7.5 Shared novelty budget, transients, and struggle-hold

- **Shared novelty budget — ≤3 novel items per turn, across ALL dimensions.** Meaning (new blend word), segmental pinyin (new sound), tone (new tone sub-track item), and structure (new system-morpheme pattern) draw from ONE budget — not four. **Never 2 novel items in a single clause.** This prevents a turn from being nominally "one new word" while actually stacking an unknown character, an unknown tone, and an unknown classifier on the learner at once.
- **Transient rare words.** A rare topic word the conversation forces in — or a RED/unverifiable word on **authentic** input that can't be substituted (§5.4) — is rendered as a **glossed transient**: shown with full scaffold + margin note, but EXCLUDED from the curriculum, from FSRS scheduling, and from both coverage-floor denominators — until it recurs naturally. Recurrence promotes it from transient to a scheduled tuple; a one-off never pollutes mastery accounting or the 98%/character floors.
- **Struggle-hold → budget 0.** When the learner is struggling (clicks breathing mastery down, a failed integrated probe, a run of meaning/segment/tone failures), the novelty budget for subsequent turns is set to **0**: no new items, FSRS-due reviews and consolidation only, scaffolds held up. The hold releases when recall recovers. This is the selection service's safety valve against compounding load.

---

## 8. Rendering & accessibility

### 8.1 Directionality: the RTL subsystem is deleted

The product renders **left-to-right, top-to-bottom only**. The Arabic instance's entire RTL/bidi/cursive-shaping subsystem — `dir=rtl` propagation, the Unicode Bidi Algorithm embedding/isolate management, joining-form contextual shaping (initial/medial/final/isolated), and ligature shaping — is **removed, not disabled**. Han characters are non-joining, fixed-width squares with no contextual forms; the only bidi the renderer touches is the trivial Latin-LTR run for pinyin syllables and Western digits, which the browser's base `dir=ltr` resolves with no app intervention. No bidi control characters are emitted into the DOM. This is a locked simplification, not a tunable.

### 8.2 Ruby/rt mono-ruby; the word-wrapper span is the tap target

Pinyin is rendered with **native HTML `<ruby>`/`<rt>`**, never a positioned-overlay or background-image scheme. Ruby is **authored mono-ruby**: exactly one `<rt>` per Han character (`<ruby>你<rt>nǐ</rt>好<rt>hǎo</rt></ruby>`), so the phonetic annotation aligns 1:1 with each glyph — except where the verified tuple's erhua slot fuses 兒 into the preceding syllable, which is authored as a single rb+rt unit spanning two glyphs (the one sanctioned break from 1:1 char↔pinyin alignment; see §3.2 surface-pinyin).

The **word**, not the character, carries the *default* interaction. Each segmented cí is wrapped in a word-level `<span class="word">` that holds the click/tap target, the FSRS unit id, and the tuple reference; the per-character `<ruby>` units nest inside it. Word-primary / character-secondary therefore **falls out of the DOM structure** rather than being computed: tapping anywhere in the word opens the lookup panel keyed on the word's `reading_id`, while character-level data (citation-pinyin, radical/IDS breakdown) is reachable from the nested character nodes. The segmenter boundary (the AS/CKIP standard, pinned end-to-end per §7) **is** the wrapper-span boundary, guaranteeing click-unit == FSRS unit. A 離合詞 with a discontinuous span (洗了個澡) is rendered as two wrapper spans sharing one `lihezi_flag` group id, so both fragments tap to the same lexeme.

**Per-dimension tap targets (the substrate for §2.4's breathe-down).** The word wrapper is the default tap target, but the lookup it opens exposes **three separately-instrumented affordances**, each emitting a distinct dimension-tagged event so credit assignment (§2.4) is honest rather than smeared: (1) the **meaning pane** → a Latent W signal for the `(word, reading)`; (2) **one tap node per character** in the breakdown, each bound to that character's `(user, character)` key → a Latent C signal for *that* glyph (this is why character data hangs off the nested `<ruby>` nodes, not the word span — it gives each character its own addressable target); (3) the **tone-cue / TTS control** → a tone-sub-track signal. The word span still owns the FSRS unit id and the tuple reference and is what a bare tap opens; but a bare word-level tap that drills into no pane charges **no** per-dimension breathe-down (§2.4's ambiguity default). The DOM thus carries word-primary interaction *and* per-character / per-dimension addressability at once.

### 8.3 Fade is opacity on a reserved band — never `display:none`

All three fade dimensions (meaning, segmental pinyin, tone) render by **lowering `opacity` on the `<rt>`** (or, for the meaning blend, by base-text swap; see §8.5). Fade **never** uses `display:none`, `visibility:hidden`, or DOM removal. The ruby annotation band is **reserved at full height for every line regardless of fade state** — the `<rt>` box always occupies its space; only its ink fades. Consequently "breathing" mastery up or down (a click that re-shows pinyin, or a fade step that hides it) causes **zero reflow**: line boxes, wrapping, and tap-target geometry are stable across the entire fade lifecycle. This is a hard rendering invariant — a layout shift on a fade transition is a regression, caught by the visual-regression gate (§8.8). Opacity is animated (CSS transition) so the fade reads as a deliberate "breath," not a flicker.

The **late tone-kept-longest state** cannot live on the `<rt>`: once the segmental pinyin letters have faded to zero opacity, a tone diacritic has no vowel letter to sit on. That state migrates to a **character-borne tone cue on the glyph** (§8.6). The early state is diacritic-on-letter pinyin ruby; the north-star state is both the ruby ink and the glyph cue gone.

### 8.4 NFC normalization at gate and at render

Every target byte is **NFC-normalized twice**: once at the gate (so the stored tuple is canonical) and again at render time (defense against any un-normalized string re-entering through a template, a gloss field, or a TTS round-trip). Pinyin with combining tone diacritics (ǐ = U+01D0, or a base letter + combining caron) is normalized to the precomposed NFC form before it reaches the `<rt>`, so font shaping and screen-reader text are deterministic. Render-time normalization is cheap and idempotent; it is the last guard before bytes become pixels.

### 8.5 The meaning blend is an inline base-text swap, not a second rt

When Latent W marks a word unmastered and the blend anglicizes it down, the English content morpheme is rendered **in the base text, in place of the Han glyph** — the wrapper span's base content becomes the English word and its `<rt>` is dropped for that word. The blend is **never** a second `<rt>` layer (English-over-glyph). Two reasons, both locked:

1. **Screen readers double-read stacked ruby.** A glyph with both a pinyin `<rt>` and an English `<rt>` is announced two or three times; an inline swap announces exactly the word that is visually present.
2. **Collision with the app's own TTS.** The product drives pronunciation from verified surface-pinyin through SSML phoneme override (§10); a second annotation layer competes with that channel. One base-text token per word keeps the audio channel unambiguous.

The swapped-in English inherits `lang="en"`; the surrounding Chinese base text is `lang="zh-Hant"`, so assistive tech switches voice per token correctly.

### 8.6 Character-borne tone cue, colorblind-safe

The late tone state renders tone **on the glyph itself**, via a dual-encoded cue: a tone **color** plus a redundant **contour mark** (a small diacritic-shaped stroke indicator), so the cue never relies on color alone. The palette is chosen for **colorblind safety** (distinguishable under deuteranopia/protanopia/tritanopia simulation, verified in the visual-regression slice). The five-way distinction (tones 1–4 + neutral) maps to five contour shapes as the primary channel, with color as reinforcement — never the reverse. This cue is **taught explicitly** (an onboarding lesson introduces the mapping) and **gate-verified** (the displayed tone matches the tuple's surface-pinyin tone). Tone is the **actively retrieved** dimension, faded last and mastery-gated; the cue is a retrieval prompt at the late stage, not a permanent passive crutch — passive tone crutches fossilize Tone-3, so even the glyph cue is on a fade track toward the north star where it too vanishes.

### 8.7 Typography, numerals, and punctuation

- **Fonts.** Body text is **Noto Sans TC / Noto Serif TC** (SIL OFL), `lang="zh-Hant"`, **subset per lesson** to the exact glyph set that lesson renders (build-time subsetting keeps payload small; a glyph outside the subset triggers a build-time miss, never a runtime tofu). Pinyin uses the same family's Latin glyphs for visual coherence.
- **No bold on tone vowels.** The renderer **never bolds the ü (u-umlaut) tone vowels** — bolding merges the umlaut dots with the tone caron into an illegible blob. Emphasis on pinyin uses color or size, never weight, on any syllable containing ü/ǖ/ǘ/ǚ/ǜ.
- **Numerals.** Chinese numeral characters are generated under the dedicated numeral verification rule (§6.8) — in particular **兩 vs 二** is resolved by the gate (兩 before measure words and hundreds; 二 as digit/ordinal), and the chosen character renders as an ordinary verified glyph with its own tuple. **Western digits (0–9) pass through** untouched as Latin-LTR runs, non-clickable, with no ruby.
- **Full-width punctuation** (，。、；：「」『』（）—— etc.) is rendered **verbatim** from the verified source, occupies its full-width box, and is **non-clickable** (outside any wrapper span, no tap target, no FSRS unit). It is never anglicized to half-width ASCII punctuation.

### 8.8 Visual-regression snapshots: the only operator-eyeball-able guard

Because neither operator nor learner reads Chinese, **no human can eyeball-verify rendered Chinese for correctness**. Visual-regression snapshots are therefore the **sole** rendering guard the non-reading operator can act on — they catch *rendering* faults (tofu/missing glyph, ruby misalignment, reflow on fade, umlaut-bold regression, colorblind-palette drift, wrong-band tone cue) **independently of** the byte-correctness gate (§6), which catches *content* faults. The snapshot suite is locked to assert:

- **Reserved-band stability:** pixel-identical line-box geometry across every fade state of the same sentence (the no-reflow invariant, §8.3).
- **Mono-ruby alignment:** one `<rt>` centered over each glyph; erhua-fused units render as the one sanctioned 2-glyph span.
- **Fade is opacity, not removal:** the `<rt>` box is present (non-zero geometry) at every fade level.
- **Tone-cue palette:** the five tone colors/contours render correctly and survive colorblind simulation.
- **No-bold-ü, full-width punctuation verbatim, Western-digit pass-through, English-swap base-text rendering** each get a fixed fixture sentence.

Snapshots run in CI on a frozen fixture set (a representative tuple slice covering erhua, 離合詞 discontinuous spans, 3-stacked-third-tone grouping, ü syllables, mixed digit/numeral, and a fully-blended sentence). A diff is a **blocking** failure: the operator reviews the rendered-image diff (which is eyeball-able even without reading Chinese, because it flags *geometry and ink* changes), not the underlying characters.

### 8.9 Vertical text: DORMANT

Vertical (top-to-bottom, right-to-left column) text is a real convention in Traditional-script publishing, but it is **DORMANT** in v1. The blocker is locked: vertical layout's idiomatic phonetic annotation is **inter-character zhuyin** (`ruby-position` running alongside the column), which **conflicts with the locked pinyin scaffold** (a horizontal, Latin, diacritic-bearing annotation that belongs *above* the glyph, not beside it). Shipping vertical text would force either zhuyin (a second phonetic system, explicitly rejected to keep one) or awkwardly-rotated pinyin ruby. The vertical-writing-mode code path is **retained but on no live path** (`DORMANT:` tag); revisiting it is gated on a future decision to support zhuyin, which is out of scope for the locked Putonghua-pinyin north star.

---

## 9. Writing / production scope

### 9.1 Handwriting is deferred (DORMANT)

Handwriting — stroke-by-stroke character production — is **out of scope for v1** and tagged `DORMANT:`. Two reasons make this a clean defer, not a gap:

- **Orthogonal skill.** Stroke-order recall is a motor/production competence with no load-bearing path to the reading north star. A learner reads authentic Traditional text without ever forming a glyph by hand; spending novelty budget on stroke sequences buys no decoding coverage.
- **Stroke-data source caveat (`DORMANT:`).** The available open stroke corpora — **Make-Me-a-Hanzi** and **Hanzi Writer** — lean Simplified/PRC in both glyph shape and stroke ordering. Traditional glyphs require **Taiwan MOE stroke order** (筆順), which differs from PRC order on common characters. Shipping the Simplified-biased data would actively teach the wrong production model. The stroke-order SVG asset is already pulled in the IDS/Unihan/Make-Me-a-Hanzi data-build step (§10) *for the read-only breakdown panel*; reusing it as a **writing trainer** is gated behind a future Taiwan-stroke-order data source and stays tagged `DORMANT:` until then.

No handwriting UI, no stroke-order grading, no canvas capture in v1.

### 9.2 v1 production surface = pinyin-IME composition + cloze

Production in v1 is **recognition-and-assembly, not free recall of glyph form**, and it reuses the verified tuple store (§7) as its answer key. Two modes, both LOCKED:

- **Pinyin-IME composition.** The learner types **pinyin** (Latin) and selects characters from an IME candidate list to assemble a target string. Pinyin IME — not zhuyin — is LOCKED so the product carries **one phonetic system** end-to-end (the same pinyin that drives the fade scaffold, TTS, and the breakdown panel). This exercises the meaning→sound→character mapping without demanding handwritten stroke production.
- **Cloze (recognition/selection).** Fill-the-blank items where the learner picks the correct word/character from a small candidate set drawn from the verified tuple table. Distractors are sourced from the same store (near-frequency, same-radical, or homophone neighbors), so every option shown is itself a verified-good byte.

Both modes draw their prompt context, gloss, citation/surface pinyin, and the correct target from the **verified tuple** — production never invents target bytes from scratch.

### 9.3 Critical rule: IME/GEC output is UNTRUSTED — it re-enters the SAME gate

This is the load-bearing safety rule of the writing module, and it mirrors the core product constraint: **neither learner nor operator can read Chinese, so no target-language byte reaches the learner unverified — including bytes the system itself produces as "the correct answer."**

The danger is **pinyin homophone density**. An IME candidate list, and especially an LLM-driven GEC "suggested correction," routinely emit a **wrong-but-real** character that is phonetically identical to the intended one (e.g. a 在/再, 的/得, 他/她/它 swap). Such a byte passes any naive per-byte sanity check and silently teaches a different real word — exactly the failure the gate exists to prevent.

Therefore: **every machine-produced target string in the writing path routes through the same gate (§6) as generated reading text — one shared chokepoint, no bypass.** Concretely:

- The **IME candidate list itself** is constrained to / re-checked against verified tuples before display.
- Every **GEC-suggested correction string** (the "you should have written X") is gated before it is shown to the learner: deterministic citation membership (CC-CEDICT Traditional field + Unihan `kMandarin`) → segmentation agreement against the normalized AS/CKIP standard → g2pW in-sentence base-reading agreement → diverse-vendor refutation jury, with the same GREEN/YELLOW/RED banding.
- **RED → WITHHELD.** A suggested correction that fails the deterministic leg is never shown; the system falls back to a known-good cached phrasing or to an English-blend rendering rather than display an unverified character.
- The **shared-chokepoint** property is the no-drift guarantee: there is exactly one verification implementation, so reading and writing cannot diverge in what they consider a valid byte.

### 9.4 Chinese GEC: taxonomy, dominant error classes, precision bias, blend-awareness

Grammatical-error correction is **LLM-driven** and classified on the standard Chinese GEC **R/M/S/W** taxonomy:

- **R — Redundant** (extra characters/words to delete)
- **M — Missing** (omitted required morphemes to insert)
- **S — Selection** (wrong-but-real word substituted — the homophone-confusion class)
- **W — Word-order**

**Dominant error classes** the corrector is tuned for — and the curriculum's first-order failure modes — are: **measure-word / classifier errors**, **particle errors (了 / 的 / 著 aspect-and-attributive confusion)**, and **homophone-confusion (S)** substitutions. These align with the function-word heteronym head set the gate already treats as ground truth (§6.8), so GEC and the gate reinforce one another rather than disagreeing.

**Precision-biased (F0.5).** The corrector optimizes **F0.5** — precision weighted over recall. A false correction (flagging correct learner output as wrong, or "fixing" it into a different real word) is more harmful to a beginner who cannot independently judge the verdict than a missed error. When confidence is low, GEC **stays silent** rather than risk a wrong correction.

**Blend-aware.** GEC operates inside the meaning-blend (§4): an **English content word the learner used because they have not yet acquired the Chinese one is NOT an error** — it is the expected, sanctioned state of an unmastered slot. The corrector reads the learner's per-word Latent-W state and suppresses any "you forgot the Chinese word" finding for words still legitimately in the English-embedded blend. It corrects the **Chinese matrix** the learner did produce (system morphemes, word order, particles, measure words) and leaves blended English content words alone.

### 9.5 Productive success updates a SEPARATE, down-weighted state

Production evidence does **not** feed the reading latents directly. Successfully composing or cloze-selecting a word is **recognition-plus-recall under selection**, a different and generally easier act than decoding that word cold in unannotated authentic text. Crediting the reading scaffold (Latent W meaning, Latent C recognition, the tone sub-track) on productive success would **over-fade the reading scaffold** and prematurely strip pinyin/gloss the learner still needs to *read*.

Therefore productive success updates a **separate, down-weighted productive-mastery state**, distinct from the reading latents that drive the blend and the fade. The productive state may *inform* scheduling (a word the learner can actively produce is unlikely to be a total reading blank) but it never substitutes for the **unscaffolded integrated reading probe** (§2.5) required to declare reading readiness. Credit-assignment discipline holds here as everywhere: production evidence is tagged by source and kept out of the dimensions it did not actually test.

---

## 10. Tooling stack, infra, risks & open items

### 10.1 The license-checked stack

The verification, scheduling, and rendering machinery is a fixed, license-audited dependency set. Every tool below is named, pinned, and quarantined by license class at build time (§10.3). Nothing on the target-byte path is chosen by convenience — each leg of the gate (§6) maps to a specific, license-cleared tool.

**Python sidecar — the g2p, segmentation, surface-resolution, and conversion module.** A dedicated Python service (new infra module; the Node/TS server has no Chinese-NLP code in-process) hosts:

| Tool | License | Role | Path constraint |
| --- | --- | --- | --- |
| **pypinyin** | MIT | Dictionary-based pinyin candidate set (the non-neural, dictionary-diverse refutation voter against g2pW) **and** the host of the rule-based `tone_sandhi` surface resolver (§3.4 stage 4b) | On gate path (verification voter + surface resolver) |
| **g2pW** | Apache-2.0 | Context-aware neural g2p; the **in-sentence base-reading agreement** leg — must AGREE on the stored heteronym choice (the base reading, **not** sandhi) | On gate path (primary neural agreement) |
| **g2pM / g2pC** | MIT / Apache-2.0 — **verify upstream** | Architecture-diverse neural g2p voters (note: g2pW + g2pM share CPP training → correlated; they count as *one* diversity axis, not two) | On gate path (secondary voters only) |
| **HanLP (configured to AS/CKIP)** | Apache-2.0 (core) | **DEFAULT segmenter, configured/trained to emit the Academia Sinica / CKIP standard** (stock HanLP models follow CTB/MSR/PKU); defines the cí boundary = click-unit = FSRS unit | On gate path (primary segmentation) |
| **jieba / pkuseg** | MIT / MIT — **verify upstream** | Segmentation voters **normalized to the pinned AS standard before agreement is scored**; post-normalization boundary disagreement **downgrades the band** | On gate path (segmentation voters) |
| **CKIP-Transformers** | **GPL-3.0** | Traditional-SOTA, AS-standard reference segmenter; behind an EXPLICIT GPL decision (§10.5), not default; may become the standard-defining segmenter | Optional, gated by license call |
| **OpenCC** | Apache-2.0 | S→T normalization of corpus sources, **UPSTREAM ONLY**, off the display path; its output is UNTRUSTED DATA that re-enters the per-word gate | Pre-generation / ingestion only, never live display |

**License-verification note (anti-invention).** The contract did not specify licenses for **g2pM, g2pC, jieba, or pkuseg**; the values above are the *expected* upstream licenses **to be confirmed at the license-hygiene build stage (§10.3) before each dependency is admitted** — they are marked *verify upstream* rather than asserted as fact. The g2pM/g2pC ordering is corrected from an earlier draft (g2pM = MIT, g2pC = Apache-2.0, both pending confirmation; an earlier draft had them swapped). The remaining licenses — pypinyin (MIT), g2pW (Apache-2.0), HanLP core (Apache-2.0), OpenCC (Apache-2.0), CKIP-Transformers (GPL-3.0), CC-CEDICT (CC BY-SA), Kaikki/Wiktextract (CC BY-SA), CHISE-IDS/cjkvi-ids (GPL-2.0), Make-Me-a-Hanzi (CC BY-SA), FSRS (MIT), pyBKT (MIT) — are as the contract specified.

The sidecar exposes one synchronous "verify this tuple in this sentence" RPC to the Node server and one batch "pre-generate + verify N candidates" job runner. Every target byte the sidecar emits is tagged with a band (green/yellow/red); the Node server **never** renders a byte the sidecar has not banded.

**g2p tool caveat (load-bearing):** every neural g2p tool here is Simplified-trained on the script side. We therefore build and maintain a **Traditional eval slice** (§6.9) and treat raw tool confidence on Traditional input as suspect until calibrated against that slice.

**The character-breakdown data build (IDS/Unihan/Make-Me-a-Hanzi).** A one-time, license-quarantined data-build step produces the click-breakdown panel's backing store:

- **Unihan** (Unicode license) → `kRSUnicode` for the Kangxi-214 radical, `kMandarin` for the candidate-reading set used by the deterministic gate leg.
- **CHISE-IDS / cjkvi-ids** (**GPL-2.0**) → the recursive IDS component tree (character → component decomposition). GPL-quarantined.
- **Make-Me-a-Hanzi** (**CC BY-SA**, leans Simplified/PRC stroke order) → stroke-order SVG. Used for the breakdown panel only; **tagged DORMANT** for handwriting (Traditional needs Taiwan stroke order — see §9.1 production deferral).

**TTS — Azure primary, Google + Polly redundant.** TTS is driven from the **verified SURFACE pinyin, never raw characters**, so input script is pronunciation-irrelevant for any overridden syllable:

- **Azure (primary):** zh-CN Putonghua neural voices, driven via SSML `<phoneme alphabet="sapi">` pinyin+tone override plus **Custom Lexicon** batch-pinning for the function-word heteronym head set (§6.8). This bypasses the engine's own g2p. **Required per-voice validation:** confirm the chosen voice honors `phoneme` (not all do), then **pin the voice version** so a vendor voice update can't silently re-pronounce a pinned syllable.
- **Google zh-CN** and **Amazon Polly (Zhiyu, Putonghua)** as redundant engines — Polly's Zhiyu is ELIGIBLE specifically because the pronunciation standard is locked to Putonghua, not Taiwan Guoyu.
- A **per-engine tone-digit adapter** converts the tuple's stored tone *marks* (§7) into each engine's expected tone-digit input format.

**Scheduling — the two latents, two libraries.** **FSRS** (MIT) schedules Latent W (per-(user, word, reading) graded recall, target R ≈ 0.8). **pyBKT** (MIT) tracks Latent C (per-(user, character) BKT recognition `P(known)`). The two run independently and feed the three fade dimensions per §3.

**Glosses.** **CC-CEDICT** (**CC BY-SA**, Traditional field, flat slash-list, no sense structure, Mainland readings — which *fits* the locked Putonghua standard) is the primary gloss source and a deterministic gate leg. **Kaikki / Wiktextract** (**CC BY-SA**) supplies the per-sense seed for the optional `frozen_sense_id`; **pin one dump and freeze the sense IDs** so a future sense-split upgrade is reproducible.

### 10.2 Runtime architecture

The system is a **Node/TS server + Python sidecar**, with a **Terraform module** provisioning the sidecar and the verified-tuple store.

- **Node/TS server** — owns the agentic LLM loop, the blend's deterministic anglicize-down transforms (§4), rendering/fade orchestration, the mastery-state updates (calling FSRS/pyBKT), and the LLM refutation-jury fan-out across diverse vendors. It holds **no** Chinese-NLP logic; it calls the sidecar for every g2p/segmentation/surface-resolution/conversion decision.
- **Python sidecar** — the §10.1 NLP stack (segmentation, g2pW base-reading, the pypinyin `tone_sandhi` surface resolver, OpenCC). Stateless per request except for warm models; all *durable* verification results land in the tuple store.
- **Verified-tuple store** — the first-class cache and source of truth for blend/fade/breakdown/TTS. Schema per §7: `(traditional_word, simplified_word, per_character[traditional], citation_pinyin, surface_pinyin, gloss, reading_id, frozen_sense_id?, band, freq_rank, variety_tag=Putonghua, bound_morpheme_flags, lihezi_flag, neutral_tone/erhua slots)`. **NFC-normalized at write; tone stored as marks, not numbers.** Cached at two granularities (§5.3, §7.1): the citation layer by `(word, reading_id)` reused free; the surface layer by `(word, reading_id, in-sentence context)`, so a new occurrence re-runs the cheap legs hot. The expensive diverse-vendor jury runs **OFFLINE at pre-generation** and is hot only on an explicit flag.
- **Terraform module** — provisions the sidecar service and the tuple store as one unit, so the verification plane is reproducible and the store's NFC/normalization invariants are infra-enforced, not convention.

**Data flow (per turn, abbreviated from §5.1; authentic un-generated text uses §5.4):** generate verified Traditional → (S→T-normalize sources upstream only) → segment (AS-configured HanLP + normalized voters) → resolve surface-pinyin in-sentence (g2pW base reading → sandhi resolver) → **GATE (band)** → anglicize-down unmastered + render fade → TTS from verified surface-pinyin. Oversample-and-rank N=3–5 against the per-turn novelty budget; keep best.

**Error handling at the gate:** GREEN → show normally. YELLOW (minor jury disagreement or post-normalization segmenter boundary disagreement) → show, but **suppress that word's fade and attach a margin note**. RED (any deterministic-leg fail) → **WITHHOLD**: substitute a known-good cached tuple or fall back to English (generated text), or scaffold-up / annotate-as-transient (authentic text, §5.4). The learner never sees red, and a sidecar timeout or vendor outage is treated as RED for that byte (fail-closed), never as a silent pass.

### 10.3 License-hygiene build stage

A dedicated build stage **quarantines copyleft and share-alike assets** away from the proprietary application code, with notices attached:

- **GPL quarantine:** CHISE-IDS / cjkvi-ids (GPL-2.0), and CKIP-Transformers (GPL-3.0) *if adopted* (§10.5). Isolated as separate processes/data artifacts, not linked into the server.
- **CC BY-SA quarantine + notice:** CC-CEDICT, Kaikki/Wiktextract, Make-Me-a-Hanzi.
- **Arphic / font licenses:** Noto Sans/Serif TC ship under OFL (clean); any Arphic-derived asset is quarantined with its notice.
- **Voter-license confirmation:** the segmentation/g2p voter licenses the contract did not pin — **g2pM, g2pC, jieba, pkuseg** — are **confirmed against their actual upstreams at this stage** before the dependency is admitted to the build. An unconfirmable or copyleft-incompatible voter is dropped, not shipped on faith. (§10.1 carries the corrected expected ordering: g2pM = MIT, g2pC = Apache-2.0, jieba = MIT, pkuseg = MIT — all pending confirmation here.)
- **Cleanroom the frequency derivation:** no Traditional-native + Taiwan-register + open-licensed + frequency-ranked list exists, so the frequency-ranked tuple table is derived **cleanroom from the Academia Sinica (Sinica) Balanced Corpus** — *not* from Simplified SUBTLEX or Jun Da. TOCFL/SC-TOP supplies the word spine and MOE-4808 the glyph standard; HSK 3.0 is a coarse, Taiwan-filtered, never-displayed prior only.

### 10.4 Ranked top risks & mitigations

1. **A wrong-but-real byte silently teaches a different real word (the product-defining risk).** A character that passes a naive per-byte check can be a valid-but-wrong glyph/reading. *Mitigation:* the multi-leg deterministic-first gate (§6) — CC-CEDICT Traditional + Unihan `kMandarin` **citation** membership, g2pW in-sentence base-reading agreement, diverse-vendor refutation jury that can only *downgrade* green; bands fail closed; the function-word heteronym head set (的/地/得, 了, 不, 一, 行, 重, 著, 和) is hand-pinned ground truth no model may override.

2. **S→T conversion injects wrong-but-real glyphs (the #2 danger — "verification is NOT easier than Arabic").** OpenCC S→T is many-to-one (发→{發 fa1, 髮 fa4}; 干→{干, 乾, 幹}). *Mitigation:* S→T runs **upstream only**, off the display path, and its output is treated as **untrusted data that re-enters the full per-word gate** — never trusted because it came from our own pipeline.

3. **Segmentation ambiguity (and cross-standard false disagreement) on non-generated surfaces.** Segmentation is the word-unit analog of Arabic diacritization ambiguity, and it is load-bearing on two surfaces we don't generate: authentic reading (the north star, ingested via §5.4) and learner writing (研究生命起源 cuts two valid ways). *Mitigation:* pin ONE standard (Academia Sinica/CKIP) end-to-end so click-unit = FSRS unit; an **AS/CKIP-configured HanLP** default with jieba/pkuseg voters **normalized to the AS standard before agreement is scored** (so a different-convention cut isn't mistaken for a wrong cut); post-normalization boundary disagreement **downgrades the band**; the 離合詞 flag licenses discontinuous spans (洗澡 → 洗了個澡).

4. **Tone-sandhi / 3-stacked-third-tone has no single deterministic surface form in isolation.** *Mitigation:* the two-layer pinyin model (citation + surface) with two-stage resolution — g2pW disambiguates the base reading, a rule-based sandhi resolver applies the occurrence-level transforms — and the gate verifying the **surface form in-sentence using explicit word-grouping** for 3+ stacked third tones; first-class neutral-tone and erhua slots; 不/一 shifts resolved at the surface layer. Dictionary membership checks citation only.

5. **IME/GEC "correct answer" output is untrusted target bytes.** Pinyin homophone density means an IME or GEC suggestion can surface a wrong-but-real string. *Mitigation:* route **every** correction/suggested string through the **same gate** — one shared chokepoint, no privileged path for our own production tooling.

6. **Numeral and bound-morpheme glossing fabricate meaning.** Number→character generation emits wrong-but-real characters; per-character glosses on transliterations (葡萄, 沙發, 咖啡, 玻璃) teach fake meanings. *Mitigation:* numerals get their own verification rule (and 兩 vs 二 is taught explicitly); the per-character `compositional|bound` flag **suppresses** per-character glosses on bound/transliteration morphemes.

7. **All g2p tools are Simplified-trained on the script side.** *Mitigation:* a maintained **Traditional eval slice**, a one-time gold seed, and **weekly sampled native-checker calibration (Cohen κ ≥ 0.8)** — the only ground truth available without a Chinese-literate operator.

8. **Vendor drift in TTS/jury models.** A voice or model update can silently re-pronounce a pinned syllable or shift jury behavior. *Mitigation:* per-voice `phoneme`-honored confirmation, **pinned voice versions** and **pinned dumps** (CC-CEDICT, Kaikki), and the SSML/Custom-Lexicon override that bypasses each engine's own g2p.

### 10.5 Open items with locked recommendations

These are tracked decisions, **resolved for v1** (not open options):

- **Sense granularity.** *Locked:* v1 keys Latent W on **reading, not fine-grained sense**. The tuple stores an optional `frozen_sense_id` (Kaikki-seeded, pinned dump) so **sense-splitting is a flagged upgrade** on the same mastery state — a recorded deviation, not a re-verification. Ship reading-keyed; defer sense-split.

- **Native-checker budget.** *Locked:* **weekly sampled** native-checker calibration against the Traditional eval slice, targeting **Cohen κ ≥ 0.8**, plus a one-time gold seed. This is the sole ground truth absent a Chinese-literate operator; the budget buys calibration, not per-byte review. The jury and deterministic legs carry per-turn load; the human carries drift-detection.

- **CKIP GPL call.** *Locked:* **An AS/CKIP-configured HanLP (Apache-2.0) is the default segmenter.** CKIP-Transformers (GPL-3.0, Traditional SOTA, the AS-standard reference implementation) sits behind an **explicit, recorded GPL decision**. Hosted SaaS generally does not trigger GPL distribution copyleft (no binary is conveyed to the user), so CKIP *may* be adopted as the hosted **standard-defining segmenter** (or as a voter) — but the call is recorded with that reasoning, CKIP is GPL-quarantined in the build (§10.3), and v1 ships on the AS-configured HanLP + normalized jieba/pkuseg voters so the GPL adoption is never a launch blocker.

### 10.6 Architecture deltas from the Arabic baseline

| Dimension | Arabic baseline | Chinese instance | Why |
| --- | --- | --- | --- |
| **Directionality subsystem** | RTL/bidi/cursive-shaping engine | **Deleted entirely** — LTR only; Han is non-joining fixed-width squares; trivial Latin-LTR bidi for pinyin/digits only | No joining, no shaping, no bidi reordering of the target script |
| **Morphology** | Inflectional morphological analyzer (agreement, clitics) | **No analyzer** — Chinese is isolating/analytic | Verification budget shifts *from* agreement-checking *to* segmentation + tone/heteronym |
| **Mastery latents** | One latent state | **Two coupled latents** — W (FSRS word/reading recall) + C (pyBKT character recognition) | An opaque glyph has no sound-it-out fallback; pinyin fade must gate on **character** recognition, not word mastery |
| **Phonetic form** | One canonical diacritized form | **Two pinyin layers** — citation (per word + char, the dictionary-membership form) + surface (per occurrence; g2pW base reading + a rule-based sandhi resolver, in-sentence) | Tone sandhi has no single deterministic surface form in isolation (3-stacked third tones); the surface form is not a dictionary entry |
| **Core gate ambiguity** | Diacritization ambiguity | **Segmentation** is the word-unit analog (inside the gate; AS-configured default + voters normalized to the pinned standard before agreement, 離合詞 discontinuous spans) | The cí boundary defines the click-unit = FSRS unit and is load-bearing on authentic reading + learner writing |
| **Unit primacy** | Word-primary | **Character co-primary** with the word (~1000 chars ≈ 90% running-text coverage) | Decoding load is gated by character coverage, separate from the word-coverage comprehension floor |
| **Blend direction** | Generate-then-anglicize-down | **Same direction, structurally safer** — Chinese = Matrix Language (word order + all system morphemes); English = embedded content morphemes only; deterministic transforms, never LLM judgment | Analytic grammar removes agreement/clitic hazards, but the never-anglicize list is **not** shorter (classifiers, aspect, complements, 得/不 potential infix, 離合詞, 把, 是…的, 的/地/得) |
| **Non-generated north star** | (reading was the target throughout) | **Explicit authentic-reading ingestion pipeline** (§5.4) — segment → surface-resolve → gate → render fade, no generation/anglicize-down; RED handled by scaffold-up, never substitution | The source can't be altered, so the generation pipeline's substitute-on-RED behavior does not apply |
| **TTS path** | Engine g2p on target script | **SSML `phoneme` override + Custom Lexicon**, driven from verified surface-pinyin | Bypasses the engine's own g2p; input script becomes pronunciation-irrelevant for overridden syllables |
| **New infra** | (none) | **Python sidecar** (g2p, AS-configured segmentation, the pypinyin `tone_sandhi` surface resolver, OpenCC) + **two schedulers** (FSRS + pyBKT) + IDS/Unihan/MMH data build | Chinese-NLP, surface resolution, and dual-latent scheduling have no Arabic-side equivalent |

---

## The locked system, in one paragraph

The tutor teaches an English-L1 beginner to read **unannotated Traditional-script Standard Written Chinese with Mainland Putonghua pronunciation** by generating **verified Traditional Chinese first** and then **anglicizing unmastered words *down*** (Chinese is the Matrix Language supplying word order and all system morphemes; English supplies bare content words only) — and, for the north-star deliverable, ingesting **authentic un-generated text** through the same gate without altering it — fading three dimensions: **meaning** (the blend, driven by per-(user, word, reading) **FSRS** recall, Latent W), **segmental pinyin** (gated by per-(user, character) **BKT** recognition, Latent C, because an opaque glyph has no sound-it-out fallback), and **tone** (its own sub-track, faded last but actively retrieved, never a passive crutch) — over a **citation-pinyin / surface-pinyin** two-layer model that resolves tone sandhi, neutral tone, and erhua **in-sentence** (g2pW disambiguates the base reading, a rule-based sandhi resolver applies the occurrence-level transforms) before display and TTS; every target byte clears a **deterministic-first verification gate** (CC-CEDICT + Unihan **citation-reading** membership, g2pW **base-reading** agreement layered with the sandhi resolver's explicit word-grouping, diverse-vendor LLM refutation jury) banded **green/yellow/red** with the learner **never seeing red**, all backed by a first-class **verified tuple store** (traditional + stored-simplified + per-character + citation/surface pinyin + gloss + reading_id + band + freq_rank + Putonghua variety_tag + bound-morpheme/離合詞/neutral-tone/erhua slots) that is the single source of truth for blend, fade, breakdown, and TTS, cached so the citation layer is reused free while each new surface occurrence pays only the cheap deterministic + g2pW + segmenter legs and the jury stays offline, with a single pinned **AS/CKIP segmentation standard** (an AS-configured HanLP default, jieba/pkuseg voters normalized to it) making the click-unit equal the FSRS unit, a cleanroom Taiwan-register curriculum (**TOCFL/SC-TOP** word spine, **MOE 4808** glyph standard, **Sinica Balanced Corpus** frequency), and a Python sidecar (**pypinyin + its tone_sandhi resolver, g2pW/g2pM, AS-configured HanLP, OpenCC**) plus **Azure** Putonghua TTS driven from verified surface-pinyin via SSML phoneme override — a stack tuned to spend its verification budget on **segmentation and tone/heteronym resolution**, the places this script can go wrong.