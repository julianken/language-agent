# Chinese Plan: Decision-Ready Synthesis (Traditional · Pinyin · Putonghua)

> **STATUS (post-brainstorm):** This is the **research snapshot** the brainstorm ran on. Its §7 open decisions have since been **resolved and locked** — pronunciation = **Mainland Putonghua**; and the "two scaffolds on one mastery state" phrasing in the intro paragraph below was **corrected by this document's own body** to **two coupled latents (Latent W + Latent C)** and **two pinyin layers (citation + surface)**. The build-ready design that supersedes the open-decision framing is **`docs/plans/chinese-instance-design.md`**. Read *this* doc for the evidence; read the spec for the locked decisions.

The product (`language-agent`) is a chat tutor that teaches a zero-Chinese English-L1 beginner to **read** authentic, unannotated **Traditional (Fan-ti / Zheng-ti) Chinese** from scratch — by blending English with the target, with a margin channel, click-any-word lookup (meaning + character breakdown + TTS audio), and writing correction, all driven by an agentic LLM loop and one FSRS-style mastery state. **Locked:** Traditional script (not Simplified); **pinyin** (not zhuyin) as the phonetic scaffold; Standard Mandarin/Putonghua pronunciation (Taiwan-Guoyu an open sub-question); counting unit = the **WORD (ci)**, with the **CHARACTER (zi)** as a secondary compounding layer; central ladder = **two scaffolds on one mastery state** — (a) an English↔Chinese meaning **blend**, (b) a **pinyin-annotation fade** — rendered by fade-by-subtraction from one stored verified tuple, where the fade "breathes" and TTS always synthesizes from verified pinyin. **Critical constraint: neither the learner NOR the operator can read Chinese, so every target-language byte must pass an automated verification gate (deterministic cross-check + diverse-LLM refutation jury, green/yellow/red bands) before it is shown — a wrong byte silently teaches a different real word.**

This file is the Chinese-instance counterpart to `docs/research/arabic-validation.md`. It merges research across 12 dimensions with adversarial verdicts on 12 load-bearing claims (each judged through Chinese-linguistics, teaching-Chinese-as-a-foreign-language, and engineering-feasibility lenses), and computes the architecture deltas from the Arabic baseline. Tooling, licenses, and the highest-stakes linguistic facts were spot-verified by web search this pass.

---

## 1. Claim verdicts

Twelve claims were advanced. Consensus verdict + confidence first, then the corrected picture for the load-bearing ones, then the **one–two genuinely dangerous misconceptions** flagged explicitly (the Arabic standout was "dialect = voice"; the Chinese equivalent is below).

| # | Claim (compressed) | Consensus verdict | Confidence |
|---|---|---|---|
| C1 | "We generate the text, so segmentation never bites the **reading** path — only learner input." | **Mostly false** | High |
| C2 | The two scaffolds map **cleanly onto two separable sub-skills** (blend=meaning, pinyin-fade=pronunciation). | **Mixed / mostly false** | High |
| C3 | **Fade-by-subtraction from ONE stored canonical pinyin holds** — sandhi doesn't break storing one citation form. | **Refuted** | High |
| C4 | **Tone fades on its OWN track, kept LONGEST** (opposite of Arabic case-ending). | **Mostly true, dangerously underspecified** | Medium |
| C5 | **Word-primary, character-aware**: word = lemma-analog FSRS key, character = **root-analog weak prior**. | **Mixed** (half right) | High |
| C6 | Verification spine = **CC-CEDICT membership + reading disambiguation, NO analyzer** because Chinese is isolating. | **Mostly false** | High |
| C7 | Never-show-wrong is equally load-bearing, but **verification is OVERALL EASIER** than Arabic (no diacritization/morphology). | **Mixed** (first half true) | High |
| C8 | English→Chinese blend is grammatically **SAFER than Arabic**, with measure-words/aspect/ba as the **only** wrinkles. | **Mixed** (direction true, "only" false) | High |
| C9 | Traditional + Pinyin + Putonghua is **internally coherent, no contradiction**. | **Mostly true, with one tagged tension** | Medium |
| C10 | Coverage math must change — unknown characters are **OPAQUE**; track BOTH character- and word-coverage. | **Confirmed** | High |
| C11 | **TTS driveable from OUR verified pinyin** via SSML phoneme override; audio never teaches a wrong reading. | **Confirmed** | High |
| C12 | Writing/production splits starkly: defer **handwriting**; v1 production = **pinyin-IME + cloze**. | **Confirmed** (with one extension) | High |

### The corrected picture on the load-bearing claims

**C1 (segmentation) — mostly false.** "We generate the text, so segmentation never bites the reading path" is true only in the *nursery* (scaffolded, generated text, where the LLM lays boundaries down by construction) and false at *graduation*, which is the product's entire reason to exist. The north star — reading authentic, **unannotated** Traditional text — is by definition not generated; click-any-word lookup there requires a production Traditional **word segmenter** for ci boundaries. Concrete on-path break: 研究生命起源 segments as 研究 / 生命 / 起源 ("research / life / origin") *or* 研究生 / 命 / 起源 ("graduate-student / fate / origin") — both real words, no spaces to disambiguate; a wrong cut glosses a word that isn't there. Segmentation is the **word-unit analog of Arabic diacritization ambiguity** and belongs *inside* the verification gate. It is also needed on a second non-generated surface: learner writing input.

**C2 + C3 + C4 (the scaffold and the fade) — this is the crux.** The two-scaffold *insight* (meaning and sound are genuinely dissociable in a logographic script — a learner can know 書 means "book" without knowing it reads `shū`) is correct and is a real strength. But "maps cleanly onto **two** separable sub-skills, **one** mastery state, **one** stored pinyin" is wrong on three coupled points the design must absorb:

- It is **3 fade dimensions, not 2**: meaning-recall, segmental-pinyin recall, and **TONE** recall (tone dissociates from segments and is the latest-acquired sub-skill).
- They ride on **2 latent states, not 1**: per-(user, word, sense) graded recall (FSRS) drives the meaning blend; a per-(user, character) **recognition** state (BKT-style P(known), accruing across words) should **gate the pinyin fade** — because pronunciation has no decode fallback, you must fade pinyin on *character recognition*, not on word-meaning mastery.
- The axes are **not independent at render time**: the meaning blend swaps the *English word in for* the Chinese glyph, so when the blend is fully scaffolded there is no character for the pinyin to annotate (a forbidden corner), and a still-visible pinyin **leaks the meaning** (pinyin→sound→known spoken word→gloss), confounding the meaning-recognition signal.

**Tone-track fade order (C4):** tone faded **last/longest** is directionally right (tone is the hardest, most lexically-contrastive sub-skill — 買 mǎi "buy" vs 賣 mài "sell" differ only by tone), **but** "kept longest" must mean *mastery-gated + actively retrieved*, not a passive perpetual crutch (passive tone crutches fossilize Tone-3). And it has a hard rendering constraint: a pinyin tone mark is a diacritic **parasitic on its vowel letter** (ǎ minus the `a` is nothing), so "drop the segment letters but keep the tone" is **not implementable** as opacity-subtraction from one pinyin string — the late "tone kept longest" state needs a **character-borne tone cue** (tone color / contour mark on the glyph), which is a display addition that must itself be taught and gate-verified.

**C5 (word vs character) — mixed.** "Word = the FSRS counting unit" holds. "Character = root-analog **weak** prior" is the wrong half: the Chinese character is **not** a weak derivative signal like the Arabic root — it is a **first-class decoding unit on a much steeper curve** (~1,000 characters ≈ 90% running-text coverage, ~2,400 ≈ 99%). It does first-order work and must be a tracked recognition state, **co-primary** with the word, not a weak prior surfaced only in the breakdown.

**C6 + C7 (the verification spine) — mostly false / mixed.** Chinese is isolating, so **no Arabic-style inflectional analyzer (CAMeL) is needed** — true. But "CC-CEDICT membership is the spine, no analyzer needed" erases the components that actually drive the bytes: a **word segmenter** (on non-generated surfaces), **context-aware g2p** (g2pW/g2pM) to verify the glyph↔pinyin *alignment in context* (membership only proves a reading is *a* valid reading of the glyph, never *the* correct one — 行 is validly both xíng and háng), **minted sense IDs** (CC-CEDICT has no sense structure; it is a flat slash-list), and a **citation→surface** resolution step (CC-CEDICT stores citation pinyin only). And "verification is OVERALL EASIER" is the dangerous strategic error — see the callout.

### ⚠ The one–two genuinely dangerous misconceptions

**DANGER #1 — "store ONE citation pinyin and fade/speak from it" (tone sandhi vs fade-by-subtraction). This is the Chinese "dialect = voice."** Standard pinyin orthography writes the **citation** tone (你好 is *written* nǐ hǎo) while connected speech obligatorily uses the **surface** tone (你好 is *spoken* ní hǎo: third-tone-before-third → second). The rule the field states plainly: *"you write the original tone, but you speak the changed one."* If the architecture stores one citation tuple and (a) renders it as the pinyin scaffold and (b) feeds it to TTS, then on the **very first phrase a beginner meets** the displayed pinyin and/or the audio teach a tone native speech never produces — and because tone is lexical (買 mǎi vs 賣 mài, 馬 mǎ vs 罵 mà are different real words), this is exactly "a wrong byte silently teaches a different real word," **self-inflicted by the data model** and uncatchable by a non-reading operator. The same fires on 不 (bù→bú before 4th), 一 (yī→yí/yì), neutral tone (媽媽 second syllable toneless), and erhua (花兒 = two glyphs → one fused syllable huār). And 3-or-more consecutive third tones (我很好) have **no single deterministic surface form** — it depends on phrase grouping — so the surface reading must be **verified per occurrence, not derived from a rule.** Fix: the tuple carries **two pinyin layers** — citation (drives the fade's "known" accounting + the breakdown) and per-occurrence **surface** pinyin (drives the displayed ruby and the TTS); the gate runs on the surface form **in-sentence**.

**DANGER #2 — "verification is OVERALL EASIER" lulling an under-built gate.** True that Chinese sheds Arabic's morphological-agreement burden (analytic language; the blend is structurally safer). But it **adds verification axes Arabic structurally cannot have**, the worst being the **Simplified→Traditional script fork**: S→T is many-to-one (发→{發 fā "emit", 髮 fà "hair"}; 干→{干 gān, 乾 gān "dry", 幹 gàn "do/trunk"}; 后→{后, 後}), and **almost every corpus, dictionary, and LLM is Simplified-native**, so a naive generator injects a **wrong-but-real** Traditional glyph with a *different* pinyin and tone — every per-byte "is this a real character" check passes green. Net verification load is **comparable-to-harder, just differently shaped**. Budget the gate accordingly; do not bank the saved morphology effort.

**Net:** the conclusions of C9–C12 are sound; the fade/pinyin data-model (C2/C3) is the one factual error to correct in the architecture, and the "verification is easier" framing (C7) is the one roadmap-misleading framing to fix.

---

## 2. What we are missing (facts that change the design)

1. **Tone sandhi makes citation ≠ surface — the headline unstated fact.** 你好 cited nǐ hǎo, spoken ní hǎo; 不/一 shift; neutral tone; erhua fuses two glyphs into one syllable; 3+ third tones are genuinely ambiguous. **Consequence:** the stored tuple needs a **per-occurrence surface-pinyin layer** in addition to citation, and the gate, the displayed ruby, and TTS all operate on the surface layer. (The single most expensive-to-retrofit change — do it before building the tuple store.)

2. **Simplified→Traditional is a wrong-but-real-glyph injector with no Arabic analog.** The #1 silent vector. All S→T conversion must stay **strictly upstream of the gate and off the display path**; any OpenCC output is untrusted DATA that re-enters the per-word gate. Prefer Traditional-native sources.

3. **Variant characters (異體字) — pin ONE canonical glyph.** ~100k MOE-catalogued variants (為/为, 裡/裏, 著/着). The stored tuple commits to the **Taiwan MOE Standard Form**; add a variant→canonical normalization step before the cross-check or yi-ti-zi throw spurious yellow/red bands.

4. **The pronunciation standard is a variety FORK, not a voice toggle.** Putonghua vs Taiwan Guoyu diverge in lexical tone (和 "and" hé vs hàn; 垃圾 lājī vs lèsè; 法國 fǎ vs fà) and lexis. Every English-gloss source (CC-CEDICT, Kaikki) carries **Mainland** readings. The chosen standard must bind **three coupled surfaces as one global config: the verification dictionary, the TTS voice locale, and the displayed pinyin.**

5. **The unknown character is OPAQUE — no reliable sound-it-out.** Phonetic-component regularity is ~40% ignoring tone, ~26% with tone, and **weakest on high-frequency beginner characters** — qualitatively worse than Arabic's partial consonantal skeleton. **Consequence:** coverage math must split into **two floors** (word-coverage comprehension + character-coverage decoding-load); never derive displayed pinyin from the glyph.

6. **The character is a first-class decoding layer, not a weak prior.** ~1,000 chars ≈ 90% token coverage. Promote it to a tracked **BKT-style P(known) recognition state** that accrues cross-word; **gate the pinyin fade on character recognition, not word-meaning mastery.**

7. **Segmentation is load-bearing on two non-generated surfaces** — authentic reading (the north star) and learner writing. No spaces; native agreement only ~90%. **Pin ONE segmentation standard (Academia Sinica / CKIP) end-to-end** so the click-unit equals the FSRS unit. Separable verbs (離合詞: 洗澡 → 洗了個澡) make a "word" a **discontinuous span** even in generated text.

8. **No open dataset ships a stable per-SENSE inventory.** CC-CEDICT is a flat slash-list (no sense IDs); Kaikki senses reshuffle every weekly dump. The per-(user, word, **sense**) FSRS key must be **minted** (LLM-segment glosses → gate-verify → freeze a pinned dump) — every minted sense is itself a target-language artifact needing a green band. (東西 = "thing," not 東+西.)

9. **Heteronyms cluster in the highest-frequency function words** — 的/地/得, 了, 不, 一, 行, 重, 著, 和 — so the danger is front-loaded onto the first words a beginner meets. **Hand-pin a head set** the gate treats as ground truth that no model may override. The danger zone is the reading-aloud / TTS path, not the glyph display.

10. **Bound-morpheme / transliteration words make the character layer degenerate.** 葡萄, 咖啡, 沙發, 玻璃 — 葡 occurs in ~1 word and has no standalone meaning. A per-character gloss **actively teaches a fake meaning**. Need a per-character `compositional | bound` flag (suppress glosses, show "single indivisible word / transliteration"), and per-(user, character, **sense**) keying so 子-as-word ≠ 子-as-empty-suffix.

11. **Four coexisting numeral systems + the 兩/二 trap.** Western digits (pass-through), character numerals (一二三…), **兩 (before measure words / for hundreds) vs 二 (the digit/ordinal)** — a learner trap with no English analog — and formal financial 大寫 (壹貳參…, defer to advanced). Numerals need their **own verification rule**: a naive number-to-character generator emits wrong-but-real characters.

12. **TTS is solved FOR us by SSML `<phoneme>` pinyin override.** Azure (zh-TW Guoyu voices), Google (cmn-Hant-TW), and Polly all accept pinyin+tone, bypassing the engine's own g2p, which makes the input *script* pronunciation-irrelevant for overridden syllables and fully controls heteronyms/sandhi. Drive TTS from the verified **surface** pinyin, never from raw characters. (Per-engine tone-digit conventions differ — Polly 0–4 vs others 1–5 — needs a thin adapter.)

**Honest north-star scope (a missing-fact in its own right):** Chinese is *easier* than Arabic on the diglossia axis — you teach the **living, natively-written, billion-user Standard Written Chinese**, not MSA (a register that is nobody's L1). But it *adds* one scoping line Arabic lacks: a **script fork** (~32M Traditional users vs ~1.43B Simplified, who dominate the online Chinese internet). State the goal narrowly: *"read authentic, unannotated Traditional-script Standard Written Chinese — Taiwan/HK/Macau publishing, books, signage."* Named non-goals: **Mainland Simplified text, colloquial written Cantonese (唔/係/嘅/喺…), and Classical wenyan.** Don't promise "the Chinese internet."

---

## 3. The dual-scaffold design, refined for Chinese

The locked "two scaffolds on one mastery state" survives as a *slogan* but becomes, precisely: **three fade dimensions over two coupled latent states, fed by a two-layer pinyin tuple.**

### The two latent states
- **Latent W — per-(user, word, sense) graded recall (FSRS).** Drives the **English↔Chinese meaning blend**. Ported unchanged from Arabic's lemma/sense state.
- **Latent C — per-(user, character, sense) recognition (BKT-style P(known)), accruing as the character recurs across words.** Realizes the locked "character grows known as it recurs." **Gates the pinyin fade** — pinyin only fades once *character recognition* crosses threshold, because pronunciation has no decode fallback the way meaning has the English channel.

### The three fade dimensions
1. **Meaning recognition** — the blend (English word vs the character). Latent W.
2. **Segmental pinyin** — the romanized syllable above the glyph. Gated by Latent C.
3. **Tone** — its own sub-track, **faded last/slowest**, T3 and T2/T3-adjacent items weighted hardest in the Difficulty prior.

### Resolving tone sandhi vs fade-by-subtraction — store BOTH, subtract from SURFACE
The verified tuple carries **two pinyin layers**:
- **citation-pinyin** (per word **and** per character) — drives the fade's "known" accounting, the click-breakdown, and the character-compounding layer. Conventionally correct to expose in the breakdown; stored NFC-normalized, tone marks not numbers.
- **surface-pinyin** (per occurrence, sandhi + neutral-tone + erhua resolved **in the sentence**) — drives **what is rendered above the glyph AND what TTS speaks**, via SSML `<phoneme>`.

**Fade-by-subtraction operates on the surface layer, never citation alone.** The gate verifies the surface form in-sentence, with **explicit word-grouping** for 3rd-tone chains (which have no single right answer in isolation). The tuple gets first-class **schema slots for neutral tone** (a syllable may be toneless in context) and **erhua** (a 兒 that fuses into the preceding syllable, breaking 1:1 char↔pinyin alignment) so the renderer and breakdown have something well-defined to show/hide.

> **Display-surface-vs-citation is a genuine open decision (§7.2).** Recommendation: render the **surface** tone in running scaffolded text so the pinyin scaffold and the TTS *agree* (the pronunciation-recall ladder must never teach a contradiction), and expose the **citation** tone + the sandhi rule in the click-breakdown.

### The tone-track fade order, made buildable
"Tone kept longest" is **mastery-gated, not display-priority**: the tone scaffold persists because tone mastery lags, and it must be paired with **active tone retrieval** (cloze/IME prompts), or it fossilizes the hardest skill. Because a tone diacritic cannot exist without its vowel letter, the fade ladder is:
- **Early / full scaffold:** diacritic-on-letter pinyin ruby (xué, mǎi) over the glyph.
- **Mid:** segmental pinyin ruby fades (Latent C threshold) while a **character-borne tone cue** (tone color or a small contour mark on the glyph) persists — this is the "tone kept longest" state, and it is a **new display vocabulary that must be taught, gate-verified, and colorblind-safe.**
- **North star:** both vanish — authentic unannotated text has neither pinyin nor tone marks; "kept longest" only governs intermediate order.

### The fade UNIT can expand from a ci to a bound collocation
Subtraction must never strand a system morpheme or split a discontinuous bracket. The tuple flags each word's **bound system-morpheme neighbors** — classifier+noun, aspect particles 了/著/過, resultative & directional complements (incl. the **得/不 potential infix** 聽得懂/聽不懂), the 把 disposal frame, the discontinuous 是…的 focus bracket, the 的/地/得 particles — plus a **離合詞 (separable) flag** so the renderer allows non-adjacent spans.

### Anglicization rules (the blend, done by subtraction)
Generate **verified Traditional Chinese first, then anglicize DOWN** the unmastered words (Chinese = Matrix Language supplying word order + all system morphemes; English = embedded **content** morphemes only — the canonical, verifiable direction). Deterministic transforms, not LLM judgment: inserted English **nouns stay bare + singular** ("three 本 book", never "books"); inserted **verbs stay bare-stem** ("eat 了", never "ate"); predicate adjectives keep the degree filler ("她很 pretty", never "她是 pretty"); negation is aspect-selected (沒 vs 不) by the frame; system morphemes are on a **never-anglicize allowlist**.

### Credit assignment (so the fades don't lie)
Never credit a fade dimension from a trial where the **other** scaffold leaked the answer: collect meaning-recognition evidence only on **pinyin-hidden** impressions and pronunciation-recall evidence only on **gloss-hidden** impressions. A **click "breathes" mastery down** and must capture *which* dimension failed (meaning / segment / tone) rather than decrementing one scalar, or the restore mechanic re-shows the wrong scaffold. Require an **unscaffolded integrated probe** (both scaffolds off, in context) before declaring reading readiness — independently "mastered" meaning + pronunciation do not sum to readiness.

---

## 4. Architecture deltas from the Arabic baseline

The Arabic baseline's load-bearing primitive survives: **the mastery state drives FSRS, the blend, and the correction policy, and every target byte passes a verification gate.** Chinese keeps that and changes the shape below.

| Area | Arabic baseline | Chinese delta |
|---|---|---|
| **Generation ordering** | Generate full vocalized Arabic → verify → anglicize unmastered + fade. | Same skeleton (generate verified **Traditional** first → anglicize DOWN), **plus** a sentence-aware **surface-pinyin resolution** stage (sandhi/neutral/erhua) between generation and rendering, and **ci boundaries emitted as an output of the tuple store** (not re-segmented). All **S→T conversion strictly upstream, off the display path**, re-entering the per-word gate as untrusted data. |
| **Segmentation** | Clitic-aware tokenization (CAMeL/Farasa); free on generated text. | **Word (ci) segmentation is the analog of Arabic diacritization-ambiguity.** Free on generated scaffolded text; **load-bearing on authentic reading (north star) + learner writing.** Pin **one standard (Academia Sinica/CKIP)** end-to-end. Multi-segmenter agreement (CKIP + jieba + pkuseg) → boundary disagreement downgrades the confidence band. **離合詞 separable flag** for discontinuous spans. |
| **Verification spine** | dediac round-trip + CAMeL morphological-analyzer membership against intended lemma+sense + CATT/Farasa consensus + diverse refutation jury. | **No inflectional analyzer.** Multi-leg gate asserting **glyph↔pinyin alignment in context**: (1) deterministic — CC-CEDICT (Traditional field) + **Unihan kMandarin candidate set must CONTAIN** the stored reading, after variant→MOE-canonical + **NFC** normalization; (2) neural — **g2pW** (context-aware) must AGREE on the in-sentence reading; (3) diverse-LLM refutation jury. **g2pW+g2pM share CPP training → NOT independent;** pair a neural voter with the dictionary leg + Unihan bound + a different-vendor LLM. Gate runs on **surface** pinyin with explicit 3rd-tone grouping. **Hand-pin the function-word heteronym head set.** Build a **Traditional eval slice** (all g2p tools are Simplified-trained). Add a **register/locale (Taiwan-vs-mainland) curation pass** upstream of and distinct from the byte gate. |
| **Breakdown panel** | Root-and-pattern (root ك.ت.ب, pattern, pos, features, caphi). | **Per-character compounding layer:** radical (Unihan **kRSUnicode**, 214 Kangxi) + recursive **IDS** component tree (CHISE-IDS / Make Me a Hanzi) + **stroke-order SVG** (Make Me a Hanzi) + per-character meaning + the word's tone-marked **citation** pinyin (Guoyu-reconciled via MOEDICT). **Suppress per-character glosses** when `bound` (葡萄/沙發). Never derive displayed pinyin from the glyph (phonetic component ~47% match). |
| **Rendering** | RTL + bidi isolation + four-way contextual letter-shaping; Amiri/Scheherazade. | **Delete the entire RTL/bidi/cursive-shaping subsystem** — Han is LTR, non-joining fixed-width squares (only trivial Latin-LTR bidi for pinyin/digits). Pinyin via native **HTML `<ruby>/<rt>`, authored mono-ruby** (one rt per Han char); the **word = a wrapper `<span>`** carrying the tap target (word-primary/character-secondary falls out of the DOM). **Fade = rt `opacity`, never `display:none`** — reserve the ruby band so "breathing" causes **no reflow**. NFC-normalize at gate **and** render. **Noto Sans/Serif TC (OFL)**, subset per lesson, `lang=zh-Hant`, **never bold ü-tone** (ǖǘǚǜ dots merge). **Full-width punctuation (，。「」、《》) verbatim, non-clickable.** **Vertical text DORMANT** (`ruby-position:inter-character` is the zhuyin pattern, conflicts with locked pinyin). The **meaning blend renders as the inline base-text swap, NOT a second `<rt>`** (avoids screen-reader double-read + collision with the app's own TTS). |
| **TTS ordering** | TTS strictly after diacritize+verify; fed the verified full vocalized form; never the engine's auto-diacritizer. | **Transfers unchanged and is stronger:** drive TTS from the verified **surface** pinyin via **SSML `<phoneme>`** (Azure `alphabet="sapi"` pinyin+tone confirmed), bypassing the engine's g2p. **Azure primary** (only engine with native zh-TW Guoyu voices + phoneme override + **Custom Lexicon** batch pinning); Google **cmn-Hant-TW** redundant; **Polly disqualified for the Taiwan branch** (Zhiyu is Putonghua-only; tones 0–4 → per-engine adapter). Verify per-voice that `<phoneme>` is honored (newer expressive voices ignore it) and **pin the voice version.** |
| **Blend grammaticality** | Caveated: VSO, agreement, ال/iḍāfa, free-morpheme constraint; insert whole NPs/verbs. | **Structurally safer — fewer failure MODES (no gender/number/case/conjugation/clitics) but NOT a shorter special-case list.** Anglicize DOWN only; inserted nouns bare+singular, verbs bare-stem (deterministic). Bound-frame **never-anglicize allowlist**: classifier+noun, 了/著/過, resultative/directional complements incl. **得/不 potential infix**, 離合詞, 把, 是…的, 的/地/得, predicate-adjective slot (force 很, never 是), 不/沒 negation, reduplication. **Shift verification budget from agreement-checking → segmentation + tone/heteronym.** |
| **Second scaffold / fade** | Vocalization fade (full→partial→none) by subtraction from one stored full form; two tracks (lexical vs case ending; drop case ending first). | **Pinyin-annotation fade, but 3 fade dimensions on 2 latent states** (§3). Subtract from the **surface** pinyin layer. Tone faded **last but mastery-gated + actively retrieved**; the late "tone kept longest" state uses a **character-borne tone cue** (diacritic can't outlive its vowel). Fade unit expands to bound collocations. Credit only from leak-free trials; require an unscaffolded integrated probe. |
| **Curriculum** | (Implicit MSA frequency + high-register pin.) | **TOCFL/SC-TOP 8,000-word Traditional-native CEFR-banded list = primary word spine** (entries already match the tuple shape: Traditional + pinyin + English). **HSK 3.0 levels 1–3 only as a coarse beginner prior where it overlaps TOCFL, never display, Taiwan-filtered.** MOE **4,808 common-character set** = north-star glyph standard + which canonical form is correct. **Dual coverage gate:** word-coverage comprehension floor (98%/95%) **+ a separate character-coverage decoding-load floor** gating fade & unscaffolded readiness. **Front-load the ~1,000 highest-frequency Traditional characters.** **Cleanroom-derive** the frequency-ranked tuple table (no Traditional-native + Taiwan-register + open-licensed + frequency-ranked list exists); build frequency from the **Academia Sinica (Sinica) corpus**, not Simplified SUBTLEX/Jun Da. |
| **Writing scope** | Reading-heavy v1; cloze minimal; free-writing correction deferred. | **Defer handwriting entirely** (stroke-order recall, orthogonal to reading; Make Me a Hanzi / Hanzi Writer carry **PRC** stroke order — wrong for a Guoyu instance — tag **DORMANT**). v1 production = **pinyin-IME composition + cloze** (recognition/selection, reusing the verified tuple, **pinyin IME not zhuyin** to keep one phonetic system). **CRITICAL extension:** pinyin homophone density makes IME/GEC "correct answer" output **untrusted target bytes** → route every correction/suggested string through the **same verification gate** (one shared chokepoint). LLM-driven CGEC (R/M/S/W taxonomy; measure-word, 了/的/著 particle, and homophone-confusion errors dominate). |
| **Infra / sidecar** | CAMeL Tools / CATT Python sidecar (new Terraform module) + verified-tuple store. | **Python sidecar** hosts **pypinyin + g2pW + g2pM/g2pC** (context-aware g2p cross-check legs) + a **Traditional segmenter** (CKIP-Transformers **GPL-3.0** server-side OR **HanLP Apache-2.0** default — explicit GPL decision) + **OpenCC** (S→T normalization upstream only) + an **IDS/Unihan/Make-Me-a-Hanzi data-build step**. **License-hygiene build stage:** subset CJK fonts; quarantine **GPL** IDS data + **Arphic / CC-BY-SA** Make-Me-a-Hanzi + **CC-BY-SA** CC-CEDICT/Kaikki with notices; **MOEDICT kept physically separate (CC BY-ND, never merged — live reference only).** The first-class **stored tuple** becomes: `(traditional-word, [simplified], per-character[trad], citation-pinyin, surface-pinyin, gloss, frozen-sense-id, band, freq-rank, variety-tag, bound-morpheme-flags, lihécí-flag)`. |

---

## 5. The named, license-checked tooling stack

All verified to exist; licenses spot-checked this pass. **Bold caveats are load-bearing.**

### Verification, g2p & conversion (the gate's spine)
| Tool | Role | License | Caveat |
|---|---|---|---|
| **OpenCC (BYVoid)** | S→T normalization of source corpora, **upstream only** | Apache-2.0 | S→T is many-to-one (干→乾/幹/干); phrase dicts reduce, don't eliminate, wrong-glyph emission. **Output is untrusted data → re-enter the gate.** |
| **pypinyin** | Deterministic dictionary g2p cross-check leg; candidate-set enumeration | MIT | Phrase-dictionary disambiguation only; weakest on novel context. **Independence from neural models is exactly why it belongs in the jury — never the synthesis driver.** |
| **g2pW (GitYCC, INTERSPEECH 2022)** | Strongest context-aware polyphone disambiguation (neural voter; learner-input path) | Apache-2.0 | Ships model weights; **CPP training is Simplified-skewed — build a Traditional eval slice;** ~99% is a cross-check, not a sole gate. |
| **g2pM / g2pC** | Architecture-diverse second/third g2p voters; g2pM ships the **CPP** benchmark | Apache-2.0 (g2pC Apache-2.0) | **g2pM+g2pW share CPP → correlated errors;** real diversity = neural + pypinyin + Unihan + different-vendor LLM. |
| **Unihan (UAX#38: kRSUnicode, kMandarin, kHanyuPinyin)** | Radical/stroke index + **candidate-reading bound** (reading not in set ⇒ RED) | Unicode License (permissive) | Character-level only; bounds the candidate set, does not pick in context. |

### Dictionary, gloss & decomposition (the breakdown)
| Tool | Role | License | Caveat |
|---|---|---|---|
| **CC-CEDICT** | Gloss + clean Traditional/Simplified/pinyin backbone; independent cross-check leg | CC BY-SA 4.0 (125k entries) | **No per-sense structure** (flat slash-list); pinyin is **citation tone-numbers + `u:`**; **Mainland readings.** ShareAlike is viral. |
| **Kaikki.org / Wiktextract (Chinese)** | Structured **per-sense** English glosses — the seed for the minted sense inventory | Data CC BY-SA + GFDL; tool MIT | **Senses reshuffle every weekly dump — pin one dump and freeze sense IDs.** |
| **MOEDICT (g0v 萌典 / MOE 重編國語辭典)** | Taiwan-Guoyu readings + monolingual sense cross-check | Dictionary text **CC BY-ND 3.0 TW**; code MIT | **No-Derivatives → cannot be merged into the tuple DB;** live reference only. Definitions are Chinese-Chinese, not English. |
| **Make Me a Hanzi** | Stroke-order SVG + IDS decomposition + etymology (semantic/phonetic component fields) | Code MIT; graphics **Arphic Public License**; dict CC BY-SA (Unihan+CC-CEDICT) | GB/Simplified-leaning; **pair with CHISE-IDS for full Traditional decomposition.** |
| **CHISE-IDS / cjkvi-ids** | Recursive IDS component trees (~88k CJK incl. Traditional) | **GPL-2.0-or-later** (cjkvi tracks CHISE) | Copyleft — data-build step only, do not commingle with app code. (Copyright provenance questioned at Unicode L2/21-118R.) |

### Segmentation
| Tool | Role | License | Caveat |
|---|---|---|---|
| **CKIP-Transformers / ckiptagger (Academia Sinica)** | Traditional-native segmentation SOTA (AS standard) | **GPL-3.0** | **Explicit license decision required** (hosted SaaS generally doesn't trigger distribution copyleft, but record the call). |
| **HanLP** | Multilingual segmentation — **commercially-clean default** | Apache-2.0 | Traditional accuracy below CKIP; verify on Traditional samples. |
| **jieba / pkuseg** | Second-opinion voters for boundary-agreement | MIT | **Simplified-trained;** boundaries follow a Simplified/PKU standard. Not the primary Traditional segmenter. |

### Curriculum & frequency (cleanroom priors)
| Tool | Role | License | Caveat |
|---|---|---|---|
| **TOCFL / SC-TOP 8,000 (+ NAER 14,425)** | Primary Traditional-native, Taiwan-register, CEFR-banded **word spine** | Taiwan MOE/NAER; no affirmative open license | Treat as a **prior to seed your own derivation**, not a redistributed asset. |
| **MOE 常用國字標準字體表 (4,808 common)** | Authoritative Traditional **glyph standard** + commonality tiers | Taiwan MOE government standard | Glyph standard + coarse tiers, not a ranked frequency list. |
| **Academia Sinica Balanced Corpus (Sinica) / Core Vocabulary (ACLCLP)** | The **Traditional/Taiwan frequency** signal | Application/agreement — **NOT open** | Derive private priors under agreement; **cleanroom** any shipped ranking. |
| **SUBTLEX-CH** | Open spoken-frequency prior | CC BY | **Simplified + mainland register** — map via OpenCC, gate-verify, never display. |
| **HSK 3.0 (ivankra/hsk30 mirror)** | Coarse beginner-band prior (L1–3 overlap) | PRC govt / repo license unchecked | **Simplified + mainland register** — convert, Taiwan-filter, gate. |

### Scheduling, TTS, fonts, writing
| Tool | Role | License | Caveat |
|---|---|---|---|
| **FSRS** | Per-(user, word, sense) graded-recall scheduler (Latent W) | MIT (algo); Anki integration AGPL | Native default retention 0.90; pick R≈0.8 deliberately. Unit-agnostic. |
| **BKT (pyBKT)** | Per-(user, character) recognition P(known) (Latent C) | Public-domain algo; MIT impls | No spacing term — pair with FSRS, don't replace it. |
| **Azure AI Speech** | **Primary TTS** — zh-TW Guoyu voices + SSML `<phoneme>` pinyin + Custom Lexicon | Commercial (free F0 tier) | Confirm `sapi` alphabet string per SDK; pin voice version (expressive voices may drop `<phoneme>`). |
| **Google Cloud TTS / Amazon Polly** | Redundant engines (Google cmn-Hant-TW) | Commercial | **Polly Zhiyu is Putonghua-only — disqualified for the Taiwan branch;** tones 0–4. |
| **Noto Sans/Serif TC + Source Han TC** | Traditional fonts + pinyin tone-diacritic coverage | SIL OFL 1.1 | Multi-MB — subset per lesson; avoid bold on ü-tone. |
| **CGEC corpora (NLPCC-2018, MuCGEC, CGED, YACLC, FCGEC)** | Writing-correction eval / few-shot (R/M/S/W) | Academic; verify per-dataset | **Simplified — eval/reference only, not displayed content.** |
| **Make Me a Hanzi / Hanzi Writer** | Handwriting module **IF** added later | MIT (data Arphic) | **PRC stroke order — wrong for Guoyu; tag DORMANT** in v1. |

---

## 6. Top risks (ranked)

| # | Risk | Mitigation |
|---|---|---|
| **1** | **Tone sandhi self-inflicts a wrong-tone teach (citation ≠ surface).** Highest severity & frequency (你好/不/一 are lesson-1 words), silent, uncatchable. A wrong tone is a different real word (買/賣). | **Two pinyin layers** (citation + per-occurrence surface); gate verifies the **surface** form **in-sentence** with explicit 3rd-tone grouping; the displayed ruby AND TTS both render surface; tuple slots for neutral tone + erhua; hand-pin the head set. |
| **2** | **Simplified→Traditional injects wrong-but-real glyphs** (no Arabic analog). Every per-byte "real character?" check passes green. | All S→T **upstream + off display path + re-enter the per-word gate**; prefer Traditional-native sources; **variant→MOE-canonical** normalization; deterministic candidate-set + neural-agreement gate; Traditional eval slice. |
| **3** | **Heteronym / glyph↔pinyin misalignment** on the reading & TTS path (行 xíng/háng), front-loaded onto 的/地/得/了/不/一. | Store reading at **word+sense**; gate asserts alignment-in-context (**deterministic-contains AND neural-agrees**); hand-pinned function-word head set no model overrides; **drive TTS from verified pinyin via SSML `<phoneme>`.** |
| **4** | **Segmentation at graduation + learner writing** — a wrong ci boundary glosses/scores the wrong span (研究生命起源). | Pin **one standard end-to-end**; production Traditional segmenter (HanLP default / CKIP behind GPL decision); **multi-segmenter agreement → confidence band**; 離合詞 flag for discontinuous spans. |
| **5** | **"Verification is easier" → an under-built gate** exactly where Chinese is *worse* than Arabic. | Reframe as **comparable-or-harder, different shape**; shift saved morphology budget into script-fork + segmentation + sandhi + variety + register; add a register/locale curation pass **distinct from** the byte gate. |
| **6** | **Opaque character / decoding-readiness mismodeled** — pinyin fades on word-mastery while the learner can't decode the glyph → stalls on unscaffolded text. | Promote the character to a **first-class BKT P(known) recognition latent**; **gate the pinyin fade on character recognition, not word mastery**; **dual coverage floors**; front-load ~1,000 chars. |
| **7** | **Variety leak (Putonghua vs Guoyu)** — Mainland readings on Taiwan text, or gloss/audio/displayed-pinyin disagree (和, 垃圾). | Pronunciation standard = **one global config binding gate dictionary + TTS voice + displayed pinyin**; variety tag on the tuple; MOEDICT reconciliation (un-merged, CC BY-ND). |
| **8** | **No sourceable sense inventory** — the per-(word, sense) key is unsourced (CC-CEDICT flat; Kaikki unstable). | **Mint sense IDs** (LLM-segment → gate-verify → freeze a pinned dump); or collapse to (word, reading) for v1 as a **recorded deviation.** Every minted sense is a gated artifact. |
| **9** | **Bound-morpheme character layer teaches fake meanings** (葡, 沙) + 子 sense conflation. | Per-character `compositional|bound` flag **suppresses per-character glosses**; per-(user, character, **sense**) keying; show "transliteration / single indivisible word." |
| **10** | **Production-correction / IME output is untrusted** (pinyin homophone density yields a different real character). | Route **every** correction/suggested-answer string through the **same gate** (one shared chokepoint); precision-bias (F0.5) CGEC; hand-pin function words. |
| **11** | **Render reflow + encoding split-brain** — fade "breathing" reflows the line; precomposed vs combining pinyin throws spurious bands; ü-tone glyph holes. | Fade via **opacity, never `display:none`** (reserve the ruby band); **NFC-normalize at gate AND render**; pin Noto TC, never bold pinyin, add a glyph-coverage assertion to the gate. |
| **12** | **License hygiene** — GPL IDS + CKIP GPL-3.0 + Arphic + CC-BY-SA + MOEDICT CC-BY-ND in one derived DB. | Data-build **quarantine with notices**; **HanLP (Apache) default segmenter, CKIP behind an explicit GPL decision**; MOEDICT physically separate; cleanroom frequency derivation. |

---

## 7. Open decisions for the brainstorm

1. **Pronunciation standard: Putonghua vs Taiwan Guoyu.** *Options:* (a) **Mainland Putonghua** — best tool support (CC-CEDICT/Kaikki/g2p all Mainland-native), but unusual paired with Traditional script and disagrees with the authentic Taiwan/HK audio environment of the same glyphs; (b) **Taiwan Guoyu** — coherent with the Traditional ecosystem (a Traditional reader meets Guoyu audio in the wild), but tooling is Mainland-trained and the only Guoyu authority (MOEDICT) is CC BY-ND. **Recommendation:** pin it as **one global config binding verification dictionary + TTS voice + displayed pinyin**; lean **Guoyu** for ecosystem coherence (Azure has native zh-TW voices) **if** MOEDICT-reconciliation cost is acceptable, else Putonghua with an explicit "formal Mainland reading of Traditional script" honesty note. (Internally coherent but unusual — tag the decision, don't leave it implicit.)

2. **Displayed pinyin: surface vs citation.** *Options:* surface (sandhi-resolved, **matches the audio**) vs citation (convention, matches dictionaries). **Recommendation:** display **surface** in running scaffolded text so pinyin and TTS never contradict; expose **citation + the sandhi rule** in the click-breakdown. (Genuine convention tension — needs a native sanity check that surface-tone pinyin reads naturally.)

3. **Tone "kept longest" rendering.** *Options:* keep the vowel host (segment and tone tracks **coupled**) vs a **character-borne tone cue** (tone color/contour, decoupled — but new display vocabulary that must be taught, gate-verified, colorblind-safe). **Recommendation:** diacritic-on-letter for the early full state; **character-borne tone color** for the late tone-kept-longest state once the pinyin ruby has faded.

4. **Mastery model: one state vs two coupled latents.** The locked spec says "two scaffolds on one mastery state." *Options:* keep one FSRS state vs split into **Latent W (word-sense FSRS) + Latent C (character recognition P(known)) gating the pinyin fade.** **Recommendation:** **two latents** — the character does first-order decoding work and the pinyin fade must gate on it, not on word-meaning mastery. (Amends the locked slogan; flag it.)

5. **Sense granularity.** *Options:* per-(user, word, **sense**) with **minted + frozen** senses vs collapse to **(word, reading)** for v1. **Recommendation:** mint+freeze from a pinned Kaikki dump if budget allows; else (word, reading) v1 with a recorded deviation. Never depend on a source's sense ordering.

6. **Segmenter + the GPL decision.** *Options:* **HanLP** (Apache, clean, lower Traditional accuracy) vs **CKIP-Transformers** (GPL-3.0, Traditional SOTA). **Recommendation:** HanLP default; CKIP server-side behind an explicit GPL decision; **pin one segmentation standard (Academia Sinica/CKIP) end-to-end regardless** so the click-unit equals the FSRS unit.

7. **Productive FSRS.** *Options:* IME/cloze success updates the **same** per-(word, sense) state vs a **separate productive state.** **Recommendation:** a separate (or down-weighted) productive state — productive recall is stronger and merging risks over-fading the reading scaffold.

8. **Store the Simplified field now vs later.** *Options:* add `[simplified]` to the tuple **now** (cheap to verify alongside Traditional; CC-CEDICT carries both; OpenCC proposes jury candidates) vs Traditional-only. **Recommendation:** **store it now** — the per-byte gate is the expensive, hard-to-retrofit asset; a future "read Simplified too" becomes a display/ladder module on the same mastery state rather than a full re-verification.

9. **Numeral convention + scope.** *Options/Recommendation:* teach character numerals 一–十/百/千 and the **兩-vs-二** distinction as vocabulary; **Western Arabic digits pass-through**; **defer formal 大寫.** Give numerals their **own verification rule** (number→character generation can emit wrong-but-real characters).

10. **North-star scope (honesty).** *Recommendation:* state it narrowly — *"read authentic, unannotated Traditional-script Standard Written Chinese (Taiwan/HK/Macau publishing, books, signage)."* Named non-goals: **Mainland Simplified, colloquial written Cantonese, Classical wenyan.** Chinese is *easier* than Arabic on diglossia (a living billion-user written standard) but adds one scoping line about the Simplified script fork — **don't promise "the Chinese internet."**

11. **Native-checker calibration budget.** *Recommendation:* approve a small recurring budget (weekly sampled Traditional/Taiwan checks, Cohen's κ ≥ 0.8) and a one-time gold-set seed — without a Traditional-literate operator this is the only ground truth on the judges, exactly as in the Arabic instance.