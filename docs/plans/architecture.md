# 20 — Synthesis: language-agent architecture

Integrated, opinionated technical design for **language-agent** — a reading/writing chatbot that teaches a target language by gradually blending it into an English conversation. This synthesizes all 13 research briefs (01–13) into one buildable plan.

The whole product rests on a single load-bearing primitive that every brief independently converged on: **a per-(user, lemma, sense) knowledge state that simultaneously (a) drives an FSRS schedule, (b) decides whether each token renders in English or target, and (c) sets what counts as an error in correction.** One data structure, three payoffs. Get that right and the blend, the SRS, the rendering, and the correction policy all fall out of it.

Recommended v1 concrete bets up front (defended in §5):
- **First target language: Spanish.** SVO + shared script + cognate-rich → naive content-word insertion stays grammatical to a high blend ratio, so the v1 blend engine is simple (02, 08, 09, 12 all point here). Japanese is the deliberate v2 stress test.
- **Blend advance = time-ratcheted ceiling × mastery allocation** (03's reconciliation of the "time vs mastery" question — both, with distinct jobs).
- **Hot path = one streamed Sonnet structured-output call;** corrections in parallel on Haiku; per-word enrichment lazy-on-click from cache (06).
- **Infra = Cloud Run + Neon + Upstash + Cloudflare R2/CDN, Terraform/OIDC** (13).

---

## 1. End-to-end flow

```
┌──────────┐   writes / clicks word / hits play
│ LEARNER  │──────────────────────────────────────────────┐
└──────────┘                                               │
     ▲  SSE stream (tokens → corrections → margin)          ▼
┌─────────────────────────── FRONTEND (React) ───────────────────────────┐
│ TanStack Virtual (message-level) · <TokenStream> delegated click        │
│ Radix Popover word-card · CSS Custom Highlight (karaoke/correction)     │
│ Tufte right-margin channel · <Ruby> scaffold (v2 CJK)                   │
└────────────────────────────────┬───────────────────────────────────────┘
                                  │ POST /turn (SSE)   GET /enrich  GET /audio
┌──────────────────────── SERVER (Cloud Run, streaming) ──────────────────┐
│                                                                          │
│  ┌── per turn, EAGER hot path ─────────────────────────────────────┐    │
│  │ 1. load learner state (Neon; blend_ratio cached in Redis)        │    │
│  │ 2. ONE Sonnet structured-output call → blended tokens[] +        │    │
│  │    self-reported ratio + sense_id self-annotations  (STREAMED)    │    │
│  │ 3. deterministic GUARD: count lang tags vs target ± tolerance;    │    │
│  │    NLP-parse the L2 spans (coherence); regenerate on violation    │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│  ┌── per turn, EAGER but PARALLEL (off hot path, when user wrote) ──┐    │
│  │ Haiku correct_learner_text tool → ERRANT-style edit-diff,         │    │
│  │ blend-aware (current stage decides what is an error)              │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│  ┌── per turn, BACKGROUND (non-blocking) ──────────────────────────┐    │
│  │ pre-warm: gloss + per-word TTS for NEWLY-INTRODUCED L2 words      │    │
│  │ update learner model from this turn's signals → recompute ceiling │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│  ┌── LAZY, on click (cached forever) ──────────────────────────────┐    │
│  │ /enrich → Tier0 NLP lemma/POS + Tier1 dict senses +              │    │
│  │           Tier2 LLM contextual sense (only if needed)            │    │
│  │ /audio  → content-hash blob from R2/CDN                          │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────┬───────────────┬──────────────┬───────────────┬───────────┘
        Neon (state)     Upstash (cache)   R2+CDN (audio)   Anthropic / Azure TTS
```

Walkthrough of the two driving learner actions:

**Learner submits writing.** Server kicks off two LLM calls *in parallel*: the Sonnet reply (hot path, streamed token-by-token so the chat paints in <1 s) and a Haiku `correct_learner_text` tool call (off hot path). The reply streams to the chat spine first; the correction diff arrives a beat later as `data-correction` SSE parts and renders under the user's message in the margin. The correction is **blend-aware**: the current blend stage is passed in, so an English word the learner used because they don't yet know the L2 one is *not* flagged as an error (11) — it may instead become a margin "nudge." Background tasks update the learner model and pre-warm enrichment for any new L2 words.

**Learner clicks a word.** No LLM round-trip on the common path. The token already carries `glossRef`/`audioRef` cache keys (the generating agent self-annotated `sense_id` at emit time, per 09's biggest latency win). `/enrich` returns Tier-0 deterministic morphology + the Tier-1 dictionary sense instantly; Tier-2 contextual LLM sense-selection runs only for genuinely ambiguous words and is then cached by `(lemma, sense_id, context_hash)`. Audio is a content-hash blob served zero-egress from R2/CDN. Target: sub-100 ms perceived on cache hit.

---

## 2. The agentic-loop shape

The central tension (06): every extra inference pass adds ~0.8–3 s, and for an interactive tutor **latency *is* the product**. So the winning shape is *minimal eager core + lazy/cached enrichment + aggressive streaming*, not a deep multi-tool ReAct loop.

### Three lanes by latency budget

| Lane | When | What | Model / mechanism | Blocks reply? |
|---|---|---|---|---|
| **Eager hot path** | every turn | the blended reply: `tokens[]` + self-reported ratio + per-token `sense_id` | **1 Sonnet** structured-output call, streamed | yes — this *is* the reply |
| **Eager guard** | mid-blend turns (~25–75% only) | coherence + ratio check, regenerate on miss | deterministic span count + NLP parse; **1 Haiku** only if needed | yes, but cheap/skippable at extremes |
| **Eager parallel** | turns where user wrote | categorized minimal-edit correction | **1 Haiku** `correct_learner_text`, async | no — renders after spine |
| **Background** | every turn | pre-warm gloss+TTS for new L2 words; update learner model + ceiling | Haiku gloss + Azure TTS + DB writes | no |
| **Lazy on click** | word click | meaning, breakdown, translation, audio | dict (Tier 0/1) + Haiku (Tier 2, rare) + cache | no |

**LLM call vs tool vs cache hit:**
- **LLM call (Sonnet):** the blended reply, and the once-per-turn blend-advance judgment (cheap, off hot path).
- **LLM call (Haiku):** corrections, contextual gloss on hard words, the mid-blend coherence guard.
- **Tool / deterministic (no LLM):** segmentation, lemma, POS, morphological features, reading/romanization, frequency/CEFR, dictionary candidate senses, ERRANT-style alignment, FSRS scheduling, ratio counting. These are the spine of the "grammatical breakdown" feature and cost zero tokens (08, 09).
- **Cache hit:** the dominant path for clicks. Per-word glosses key on `(lemma, sense_id, dump_version)`; contextual glosses on `(lemma, sense_id, context_hash)`; audio on `sha256(text + lang + voice + model + rate)`. The product is full of repeated function words, so most clicks are sub-100 ms cache hits with zero LLM cost.

### How latency is hidden
1. **Behind the stream.** Stream the chat spine token-by-token; structured span metadata is the small tail of the same response (fine-grained tool streaming). TTFT drops from ~4 s to ~0.6 s; perceived speed jumps even at identical total latency (06).
2. **Behind parallelism.** Correction runs *alongside* the reply, never after it.
3. **Behind the cache.** Clicks hit precomputed enrichment; the generating agent pre-annotates senses so click-to-define is a cache lookup.
4. **Behind prompt caching.** Persona + blend rubric + tool defs + dictionary candidates sit before one cache breakpoint → ~90% cheaper input, up to 85% lower latency on the prefix. Pre-warm at session start. **Tripwire:** any per-request token (timestamp, turn counter) *before* the breakpoint busts the whole cache — keep volatile content after it.

### How the loop generates coherent blended text at a target ratio
This is the defining requirement, and it is a **generate → validate → regenerate** loop (02, 04, 06), not a prompt hope:
1. **Generate.** Pass the (cached) system prompt the current target ratio + a hard rubric: *blend whole constituents, never break grammar; insert content words into an English frame first; only emit L2 words that are in the supplied known/learnable set and are confidently glossable.* Force structured output with per-token `lang` tags and a **self-reported achieved ratio**.
2. **Validate (deterministic, cheap).** Count `lang:target` vs `lang:en` spans → real ratio. If outside tolerance, regenerate. Run the L2 spans through the per-language NLP analyzer; if a fragment fails to parse or mixes scripts mid-word, it's a Frankenstein sentence → regenerate. This is far more reliable than asking the model to "aim for ~40%."
3. **Coherence guard (LLM, conditional).** Only in the volatile mid-blend band (~25–75%), one Haiku pass checks the switch happens at clause/phrase boundaries, not mid-phrase. Skip near the extremes where mixing is trivially safe.

Do **not** trust the LLM to self-hit a ratio: the code-switching literature (02) shows models drift back toward the dominant language and lose ratio control at extremes. The server's deterministic span count is the source of truth.

---

## 3. Interactive-message schema

Built on 07's design: **tokens are the spine; per-token `lang` IS the blend made concrete** (so the ratio is a measurable property of the payload, `count(lang==L2)/total`, never an opaque setting). Corrections and margin notes are **stand-off**, keyed to token IDs (so a gloss, a correction, and a lang tag can all cover the same word without conflict). Field names borrow CoNLL-U (`lemma`, `upos`, `feats`) and ERRANT (`R:VERB:TENSE`) so any future eval tooling speaks a standard vocabulary. Only `id`, `text`, `lang`, `kind` are required per token; everything else is **lazily hydrated** — the eager payload carries `glossRef`/`audioRef` *strings* (cache keys), not blobs.

```jsonc
{
  "type": "tutor-message",
  "schemaVersion": "1.0",          // ship schemaVersion + tolerant-reader from msg #1
  "messageId": "m_8f2a",
  "role": "assistant",
  "blend": {
    "ratio": 0.34,                 // server-verified, = count(lang==target)/contentTokens
    "ceiling": 0.40,               // time-ratcheted cap this word fills under
    "advancedBy": "mastery",       // "mastery" allocates beneath the "time" ceiling
    "guard": "clause-coherent",    // passed | regenerated:ratio | regenerated:coherence
    "unknownTokenShare": 0.04      // brand-new L2 tokens; coverage floor wants <= 0.05
  },
  "tokens": [
    { "id": "t0", "text": "Let's order a", "lang": "en", "kind": "text" },
    { "id": "t1", "text": "café",  "lang": "es", "kind": "word",
      "lemma": "café", "upos": "NOUN", "feats": "Gender=Masc|Number=Sing",
      "status": "familiar",        // learner-model status drives styling + scaffold
      "glossRef": "g/es/café#cafe-drink",     // (lemma, sense_id) cache key
      "audioRef": "a/es/café/es-ES-Neural",   // content-hash audio key
      "ruby": null },              // {base,reading} for CJK / early romanization (v2)
    { "id": "t2", "text": "para mí", "lang": "es", "kind": "phrase",
      "memberIds": ["t2"], "glossRef": "g/es/para_mí#for-me" },
    { "id": "t3", "text": "?", "lang": "en", "kind": "punct" }
  ],
  "corrections": [                 // stand-off; references the USER turn's token IDs
    { "id": "c0", "targetMessageId": "u_8f29",
      "op": "R", "origTokenRange": ["ut4","ut4"],
      "original": "voy", "replacement": "fui",
      "errorType": "R:VERB:TENSE",
      "severity": "grammatical",   // blocks_meaning > grammatical > naturalness > nitpick
      "blendStatus": "l2_error",   // l2_error | allowed_l1_fallback | nudge_opportunity
      "note": "Preterite needed for a finished past action: fui, not voy.",
      "noteLang": "en" }           // note language migrates en→target as blend matures
  ],
  "margin": [
    { "id": "n0", "kind": "grammar",   "anchorTokenId": "t1",
      "body": "Nouns ending in -é are usually masculine.", "lang": "en" },
    { "id": "n1", "kind": "nudge",     "anchorTokenId": null,
      "body": "You can say \"manzana\" for apple next time.", "lang": "en" },
    { "id": "n2", "kind": "encourage", "anchorTokenId": null,
      "body": "Nice — you reached for an L2 noun unprompted!", "lang": "en" }
  ]
}
```

**Streaming order (SSE, Vercel-AI-SDK `data-*` parts):** stream `tokens` first (chat paints immediately), then emit `corrections` and `margin` as `data-correction` / `data-margin` parts *after* the token stream, because ERRANT alignment needs the whole corrected form and partial JSON can't be validated mid-stream. Key everything to **token IDs, never raw character offsets** (offsets drift if anything re-tokenizes). Emit offsets, when needed, as **code-point indices** (JS UTF-16 surrogate-pair gotcha, 08). User-turn tokens get a lighter schema — enough for inline correction highlighting — and the same clickable treatment so learners can look up their own words.

---

## 4. The blend engine

The blend is the product's state machine. Its computation is **bottom-up and emergent**, not a global dial (03, 04).

### Where the ratio is computed
The realized ratio is a **property of the generated payload** — the server counts `lang:target` content tokens after generation. The *target* ratio the agent aims for is the learner's **time-ratcheted ceiling**, read from Neon (cached in Redis to avoid a per-turn DB round-trip).

### What advances it — the reconciled answer to "time vs mastery": **both, with distinct jobs.**
- **Time ratchets the ceiling.** A global `blend_ceiling` rises on a slow schedule (e.g. a small step per active week, gated by activity so an absent learner doesn't drift). This guarantees a stalled-but-present learner still feels forward motion — the **floor against stalling** that pure-mastery advancement risks.
- **Mastery allocates beneath the ceiling, word by word.** Per-(user, lemma) state decides *which* specific words fill the budget. A word graduates into the unglossed target stream once it reaches `familiar`/`known`; the aggregate of these per-word decisions *is* the ratio, capped by the ceiling.

This is the operationalization of the SLA finding (01): **define blend ratio = target-token share subject to ≥95% running-word coverage**, where coverage is the hard constraint and ratio is the dial inside it. Time-only advancement is the single biggest pedagogical risk — it routinely violates the coverage threshold and tanks comprehension — so time is a *ceiling and floor*, never the primary allocator.

### How the learner model feeds it
One table, `word_state`, per `(user_id, lang, lemma, sense_id)`:
- FSRS `stability`, `difficulty`, `due`, `last_review` (via `py-fsrs`, the single memory engine — no SM-2, no custom HLR in v1; 03).
- A derived LingQ-style `status ∈ {new, learning, familiar, known, ignored}` for UI + blend gating, computed *from* FSRS so the two never disagree (e.g. `S > 30d & R > 0.9 ⇒ known`).
- Signal counters: `seen_count`, `clicked_count`, `correct_uses`, `source`.

**Mastery inputs, ranked (mapped to FSRS `Rating`):** correct unprompted use in writing (strongest, → `Good`/`Easy`) > explicit review grade > a word **click** (a soft "I didn't know this", → `Again`-ish, *lowers* status so the blender backs off that word) > passive read without click (weakest positive). Weight implicit signals far below explicit ones — "didn't click" ≠ "knows it" (maybe they skimmed), and over-trusting it over-promotes words and breaks comprehension.

The per-word blend decision sits in the **hot path of every generated turn**, so it must be a cheap state lookup, never an LLM call or an FSRS re-train. Precompute statuses; the blend-advance *judgment* runs once per turn in the background.

### Cold start
A brand-new user has no per-word data, so mastery can't drive day-1. Seed from a **CEFR/frequency-band placement probe** (using `wordfreq` zipf + Kelly/CEFRLex lists), assume the top-N frequent lemmas are "learnable first," and let the time ceiling carry early sessions. Ship published default FSRS weights; re-optimize per user only after hundreds of reviews accrue.

### How incoherent mixing is prevented (four layered guards)
1. **Coverage floor (generation constraint):** never let a sentence drop below ~95% known-word coverage; ≤2–5% of tokens may be brand-new L2. Known-but-L2 tokens don't count against this.
2. **Constituent-boundary rule (generation constraint):** insert whole content-word phrases (NP/AdjP) into an English matrix; defer function words, particles, and reordered clauses until the target band is mastered. This is the proven-safe Toucan/diglot move and is language-pair-aware (cheap for Spanish, the hard part for Japanese).
3. **Deterministic validator (post-generation):** server counts the realized ratio and parses the L2 spans through the NLP analyzer; ratio miss or parse failure → regenerate.
4. **LLM coherence guard (conditional):** one Haiku pass in the mid-blend band confirms clause-boundary switching.

The blend should **breathe, not monotonically climb**: if the learner's L2-error rate spikes, drop the ratio back, and surface *why* in the margin so a more-English turn never reads as punishment.

### Two decoupled dials
`read_ratio` (how much of the reply is L2) runs *ahead of* `write_ratio` (how much L2 we expect from the learner), because recognition precedes production. Early writing is Clozemaster-style fill-one-L2-word; graduate to full L2 sentences. Decouple from day one (02).

---

## 5. Build-vs-buy / LLM-vs-classical calls

The governing principle (08, 09): **segment and analyze with deterministic libraries; use the LLM only for contextual meaning and natural-language notes.** Libraries are cheap, cacheable, reproducible; the LLM is for the contextual sense, idioms, and grammar prose where it genuinely adds value — and the glossing literature shows LLMs are unreliable at *joint* segmentation anyway.

| Capability | Decision | Why |
|---|---|---|
| **Segmentation / morphology / POS / reading** | **Classical libraries**, per-language adapter behind one `analyze(text, lang) -> Token[]` interface. Spanish: spaCy (whitespace, trivial). v2 JP: fugashi+UniDic (segmentation + lemma + reading + POS in one MIT call). | Deterministic, cacheable, free; the breakdown panel comes straight from the dependency parse with no LLM call. Build the **per-token language-ID / language-run splitter first** — it's the precondition for clickability *and* the blend in a mixed stream. |
| **Dictionary / translation** | **Buy open data, constrain the LLM.** Three-tier: Tier 0 NLP lemma → Tier 1 dictionary candidate senses (Kaikki/Wiktionary, JMdict, CC-CEDICT) → Tier 2 LLM picks + explains the contextual sense, only when ambiguous. | Bounds hallucination (LLM chooses among *real* senses, never free-generates an L2 word's form — the asymmetric low-resource fabrication risk). Gives a citable definition for free. **Add the CC-BY-SA attribution footer from day one.** |
| **TTS** | **Buy: Azure Neural TTS** primary. | Only provider bundling 140+ languages + native **word-timing marks** (WordBoundary / SSML `<bookmark>`) for karaoke highlight + identity-preserving multilingual voices across the English↔target seam + lowest neural price + a future pronunciation-scoring path. OpenAI/Google give *no* word timings → disqualified as primary if karaoke is in scope. (13 floats OpenAI `gpt-4o-mini-tts` on pure cost, but the timing requirement decides it for Azure; ElevenLabs is the quality upgrade path.) |
| **Correction** | **LLM-first, deterministic guards.** One `correct_learner_text` Haiku tool returning ERRANT-style categorized minimal-edit diffs, with a mandatory verification pass and self-hosted **LanguageTool** as a cheap false-positive cross-check once a 2nd language ships. | LLMs over-correct (rewrite fine text for fluency) — the cardinal sin for a learner tool. Minimal-edit constraint + verify pass + severity gating + **blend-aware policy** (the current stage decides what even counts as an error) are non-negotiable. |
| **SRS / learner model** | **Buy: FSRS via `py-fsrs`**, fronted by a LingQ-style status enum. | Strictly beats SM-2 (~25–30% fewer reviews for same retention), drop-in library, exposes queryable retrievability `R` — the exact hook the blend decision needs. Defer DKT/LLM-KT and per-user weight optimization. Ship `genanki` `.apkg` export as the integration story; defer Anki import/sync. |

LLM tiering (06): **Sonnet** for the blended reply + blend-advance judgment (content generation needs the bigger model); **Haiku** for corrections, glosses, breakdowns, and the coherence guard (smaller models suffice for assessment/correction).

---

## 6. v1 infra / Terraform stack

One cloud (GCP) for compute/state/secrets; Cloudflare for object storage + CDN; Neon/Upstash as managed SaaS (13).

| Concern | Choice | Why |
|---|---|---|
| **Hosting** | **Cloud Run** (SSE backend, `min-instances=0` to start → 1 with users + CPU boost) | 60-min timeout headroom for the agentic loop; real concurrency (one warm instance fans out many slow LLM/TTS calls); native HTTP/2; no buffering of sub-32MB chunked responses; clean Secret Manager env-var injection. Lambda is streaming-hostile (30 s edge idle timeout). |
| **Primary data** | **Neon Postgres** | Serverless, scale-to-zero ($0 idle). Holds learner profile, `word_state` (the data that drives the blend), conversation history, error ledger. Co-locate in Cloud Run's region for the per-turn blend-state read. |
| **Cache** | **Upstash Redis** | Pay-per-command fits bursty interactive traffic. Caches current blend ratio, gloss/breakdown, and TTS-text keys. Set TTLs to bound cost. |
| **Audio blobs** | **Cloudflare R2 + CDN** | **Zero egress** — every replayed cached word costs nothing to serve (~$1.50 vs ~$47/mo on S3 for 500 GB egress). Audio cache hit-rate *rises* as the blend deepens (recurring high-frequency vocab), so R2 amortizes TTS spend exactly when target volume grows. |
| **Secrets** | **GCP Secret Manager**, injected as Cloud Run env vars | Never in TF code or state; `sensitive = true`; LLM/TTS keys never in `tfvars`. |
| **Observability** | **Langfuse Cloud (free tier)**, OpenTelemetry-wired | Traces the agentic loop, token cost/turn, TTFT, and the coherence guard's marginal cost. Portable via OTel; self-host only if volume demands (it drags in Postgres+ClickHouse+Redis+S3). |
| **IaC** | **Terraform** (or **OpenTofu** if you want native state encryption, reasonable given LLM/TTS key resources in state). GCS remote state + versioning, **GitHub OIDC / Workload Identity Federation** (no long-lived keys), **folder-per-env**. | Folder-per-env beats workspaces for blast-radius control. Modules: `network`, `cloudrun-app`, `secrets`, `data-neon`, `cache-upstash`, `storage-r2`, `observability`. |

**CI/CD via agentic-seed:** PR triggers `fmt -check` / `validate` / `plan` (the plan comment *is* the reviewed diff that slots into agentic-seed's reviewed-PR gate); merge to `main` triggers `apply` to prod via OIDC; the app image build + `gcloud run deploy` run in the same pipeline.

**SSE tripwire to test end-to-end:** disable proxy buffering explicitly (`X-Accel-Buffering: no`, `Cache-Control: no-cache, no-transform`). Buffering is invisible locally and batches tokens in prod; verify token-by-token arrival through the whole proxy/CDN chain.

---

## 7. Top 8 risks, ranked

| # | Risk | Mitigation |
|---|---|---|
| **1** | **Time-driven blend advancement breaks comprehension.** Advancing on a clock/streak over-promotes learners past words they haven't acquired, violating the 95% coverage floor — the single biggest pedagogical risk, and it invalidates the whole product thesis. | **Mastery allocates, time only ratchets the ceiling.** Per-word FSRS status decides *which* words go L2; the per-sentence coverage floor (~95%, ≤5% unknown) is a hard generation constraint with a regenerate guard. Let the ratio fall when error-rate spikes. |
| **2** | **Frankenstein sentences** — incoherent code-mixing (wrong gender/case/order around a swapped word, mid-phrase switches), worse for SOV/non-Latin languages. | Word-level constituent insertion into an English frame in v1; **generate → deterministic validate (NLP-parse L2 spans + ratio count) → regenerate**; conditional Haiku coherence guard in the mid-blend band. **Ship Spanish first** so v1 never hits the hard typological cases. |
| **3** | **LLM over-correction** — rewrites grammatically-fine text for fluency, and "fixes" the English half or clean L1 fallback of a blended sentence. Destroys trust and contradicts the product premise. | Minimal-edit-only constraint + mandatory verification pass + target-span-only scoping + **blend-aware policy** (below-expectation English = free, never an error). Pass the blend stage and per-token lang tags into the corrector. LanguageTool false-positive cross-check. |
| **4** | **Latency death** — agentic depth, per-word lookups, or synth-on-click make interaction feel sluggish; clicks/corrections must feel <300–500 ms. | One streamed Sonnet call on the hot path (no planning loop); correction in parallel; **lazy per-word enrichment from cache** with agent-emitted `sense_id` pre-annotation; prompt-cache the stable prefix; pre-warm TTS for new words in the background. |
| **5** | **Wrong-sense / hallucinated glosses** — a bare dictionary dump on a polysemous word misleads; LLMs invent plausible fake L2 words (asymmetric in low-resource langs), and drop to ~46% F1 on fine-grained senses. | Dictionary as candidate generator, LLM as constrained *selector* (never free-generates an L2 word's form); pass sentence context; key by `(lemma, sense_id, context_hash)`; surface confidence; **gloss confidence/coverage gates whether a word is safe to render in L2.** |
| **6** | **Code-switch TTS quality cliff** — mixed-language sentences are measurably less intelligible synthesized, and exactly the embedded foreign words (the ones learners most need) take the biggest hit; most engines fix language per call. | **Per-word audio is pre-generated, cached, voiced in its own locale** — sidesteps the cliff entirely and is a correctness win, not just latency. Mixed-sentence playback = segment by language → synthesize each span in one multilingual voice → concatenate; gate full-sentence playback behind a minimum target ratio. |
| **7** | **Cold-start & implicit-signal noise** — no per-word data on day 1; "didn't click" ≠ "knows it" leads to over-promotion. | CEFR/frequency placement probe + frequency-band prior + time ceiling carry early sessions; ship default FSRS weights; **weight implicit signals far below explicit** (writing correctness ≫ review grade ≫ click ≫ passive read). |
| **8** | **Schema churn & offset drift** — the token schema evolves weekly early; character-offset-keyed corrections/highlights land on the wrong word if anything re-tokenizes. | `schemaVersion` + tolerant-reader (ignore unknown fields, additive-only changes) from message #1; **key all stand-off annotations to stable token IDs, never raw offsets**; pin dictionary/segmenter versions so cached offsets don't silently drift; emit code-point (not UTF-16) indices. |

---

## 8. Phased build order

**The thinnest end-to-end vertical slice first**, then layer richness onto a working spine. Ship Spanish throughout; Japanese is the v2 stress test that forces the hard cases.

### Phase 0 — Walking skeleton (one coherent blended turn, end to end)
The goal is the full pipe lit up, even if shallow. Cloud Run server + Neon + minimal Terraform/OIDC. One Sonnet structured-output call producing `tokens[]` with per-token `lang`, streamed over SSE. React `<TokenStream>` rendering English-with-Spanish-content-words, styled by lang tag. **A fixed blend ratio** (no advancement yet) with the **deterministic ratio-count + regenerate validator** — because coherence is foundational, not a later polish. No clicks, no correction, no audio. *Done = a learner reads one coherent blended reply that hits a target ratio.*

### Phase 1 — Make it interactive (clickable + audio)
The three-tier lookup pipeline (NLP lemma → dictionary senses → LLM contextual sense) behind `/enrich`; Radix Popover word-card with meaning + breakdown + translation. Azure per-word TTS, pre-warmed in the background, cached in R2/CDN, played from the card. Agent emits `sense_id` self-annotations so clicks are cache hits. *Done = click any L2 word → instant gloss + breakdown + audio.*

### Phase 2 — Make it teach writing (correction)
Parallel Haiku `correct_learner_text` tool returning ERRANT-style categorized minimal-edit diffs as `data-correction` SSE parts; margin renders the diff + category chip + explanation. Minimal-edit + verification-pass anti-overcorrection guards in from the start. Early cloze-style `write_ratio`. *Done = learner writes, gets blend-aware categorized correction in the margin.*

### Phase 3 — Make the blend alive (learner model drives it)
The `word_state` table + `py-fsrs`; LingQ status derived from FSRS. Wire signals (writing correctness, clicks, reads) into the per-word ledger. Switch the fixed ratio to **time-ratcheted ceiling × mastery allocation**; per-word render decisions fill the budget. Margin shows the live ratio and *why* it moved. Cold-start placement probe. *Done = the blend advances per-reader on mastery, capped by time, and can breathe down on errors.*

### Phase 4 — Polish & scale the experience
Karaoke highlight (Azure word-timing marks + CSS Custom Highlight API); margin migrating en→target; manual Word-Wise-style assistance slider over the automatic blend; named pinned tutor persona; `genanki` export; Langfuse dashboards; `min-instances=1` + CPU boost. Decouple a fuller `write_ratio` ladder.

### Phase 5 (v2) — Japanese stress test
The hard cases the architecture was built to absorb but Spanish never exercised: fugashi+UniDic segmentation, the language-run splitter under real load, `<Ruby>` furigana scaffold tied to per-word status, constituent-level (not word-level) blending for SOV order, segment-and-stitch mixed-sentence audio, JMdict attribution. Self-host LanguageTool for the 2nd language as a false-positive guard.

---

### One-line thesis
**Make the per-(user, lemma, sense) knowledge state the single source of truth** — it drives FSRS, decides each token's language (the blend), and defines what counts as an error — then keep the hot path to one streamed Sonnet call guarded by a deterministic ratio+coherence validator, with everything else lazy, cached, and parallel.
