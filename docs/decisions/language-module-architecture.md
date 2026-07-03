# ADR: Language-Module Architecture — Drop-In Language Packs

**Status:** Accepted (operator-directed: drop-in language modularity is a core requirement)
**Date:** 2026-07-02
**Owner:** julianken/language-agent
**Depends on:** `docs/decisions/hosting-walking-skeleton.md` (one Cloud Run service, two containers, 553MB pruned Arabic sidecar), `docs/decisions/design-system-inheritance.md` (value deltas via Locale variable modes; structural deltas via swapped components)
**Feeds:** epic #3 (walking skeleton), children #5–#11 plus two new children (`contract-v0`, `lang-conformance-tck` — numbers assigned at filing; see §5.3)

## Context

The engine ships one language per deployed instance (Arabic first, Chinese fully specified, language N intended). The requirement is drop-in: a config names the language's modules, sidecar image, and assets; switching or adding a language touches **nothing outside config plus that language's own packages**. The committed Arabic and Chinese specs define exactly nine seams where languages differ (verification gate legs, steering constraints, annotation payloads, mastery-model shape, curriculum floors, renderer anatomy, TTS driver, sidecar image, data assets). The contract below covers exactly those nine — no tenth "misc hooks" slot (research: plugin-architectures — anti-pattern "hook sprawl"; nlp-precedents — anti-pattern "speculative language-N abstraction").

The decisive structural fact (research: plugin-architectures): we are building a **driver registry** — one implementation per seam, selected at build/deploy time — not a multi-plugin pipeline. That eliminates the entire ordering/hook-bus problem class (Vite `enforce`, webpack Tapable) and makes Pure DI viable.

One shaping rule ran through every revision of this document: **the contract must be zh-true, not ar-first**. Arabic is the first implementation, and the first implementation's accidents are the most dangerous candidate contract (research: polyglot-sidecar-contract). Where the two specs disagree about *where a responsibility lives* (segmentation, per-character scaffolds, RED handling on authentic text), the contract takes the more general shape now, while it costs a type edit instead of a data migration.

---

## 1. The contract

### 1.1 Package: `@la/contract`

A standalone, semver'd package with **zero runtime dependencies on the engine** — pure TS types, zod schemas, the hand-authored sidecar OpenAPI document, and the manifest schema. Engine, language packs, and the TCK all depend on it; nothing depends on the engine (research: plugin-architectures — webpack #12606 "plugins importing host internals"; monorepo-layout — contract/engine split so `import type` from engine can't couple packs).

### 1.2 The `LanguagePack` object

A language pack is a plain, fully-typed manifest object — ESLint-flat-config shape, not a class hierarchy (research: plugin-architectures — ESLint flat-config verdict):

```ts
export interface LanguagePack<TAnn = unknown> {
  meta: {
    lang: LanguageId;                 // 'ar' | 'zh' | ...
    packageVersion: string;
    contractVersion: string;          // must EQUAL the engine's CONTRACT_VERSION; asserted at boot.
                                      // All packs are in-tree, workspace:*-pinned, deployed lockstep — a
                                      // semver RANGE has nothing to flex against. Ranges return if a pack
                                      // ever leaves the tree (documented escape hatch, not built).
  };
  // — the nine ports, one per delta seam —
  verificationGate: VerificationGateFactory<TAnn>;   // seam 1
  steeringPolicy: SteeringPolicyFactory<TAnn>;       // seam 2
  annotationCodec: AnnotationCodec<TAnn>;            // seam 3
  masteryModel: MasteryModelFactory;                 // seam 4
  curriculumPolicy: CurriculumPolicyFactory;         // seam 5
  rendererManifest: RendererManifest;                // seam 6 (keys; components ship at /react subpath)
  ttsDriver: TtsDriverFactory;                       // seam 7
  sidecarDescriptor: SidecarDescriptor;              // seam 8 (image ref + expected capabilities)
  assetManifest: AssetManifest;                      // seam 9 (named assets + spine schema)
}
```

There is deliberately **no declared `capabilities` block**: direction, unit kinds, fade dimensions, gating edges, floor ids, and the sidecar image are all already carried by the ports above. A second declaration of the same facts inside one package is a drift surface with no consumer the ports don't serve. Instead the boot path computes `deriveCapabilities(pack)` — a pure function over the ports — and cross-checks it against the sidecar's `/v1/capabilities` response (§2.2, §3.3), which is where the check earns its keep (two *processes* agreeing, not one package agreeing with itself).

Each factory receives a **narrow `PackContext`** — the typed sidecar client (generated from the shared OpenAPI, bound to the pack's declared image), an asset reader scoped to `assetManifest`, a logger, the pack's validated config slice, and the engine's shared FSRS library. Never the engine, never another seam's objects (research: plugin-architectures — Fastify encapsulation, anti-god-context).

### 1.3 The nine ports

| # | Port | Responsibility | Shape (TS sketch) |
|---|------|----------------|-------------------|
| 1 | `VerificationGate<TAnn>` | The trust spine — **text-in, tokens-out**. The gate receives the candidate target text plus the turn's intents and returns the banded token stream: token boundaries are an *output* of verification, not an input. This is spec-mandated: the Chinese gate performs segmentation *inside* the gate (chinese-instance-design.md §6.0 "Segmentation is therefore inside the gate, not a preprocessing convenience"; §5.1 stages 3–5) — the multi-segmenter boundary vote can downgrade a band, and 離合詞 separable verbs are minted as discontinuous spans at segmentation time. Arabic, whose LLM emits pre-tokenized self-annotated output, trivially maps its tokens through. Leg *composition* (ar: dediac round-trip + CAMeL membership; zh: CEDICT/Unihan + g2pW agreement + segmenter vote + sandhi resolver) lives entirely inside the pack, mostly delegated to its sidecar. | `verify(candidate: { targetText: string; intents: TurnIntent[] }, ctx: TurnContext): Promise<VerifiedToken<TAnn>[]>` where `VerifiedToken = { spine: TokenSpine; band: 'GREEN'\|'YELLOW'\|'RED'; evidence: LegEvidence[]; annotations: TAnn }`. `TokenSpine` carries an optional `spanGroup: SpanGroupId` so one learnable unit can map onto multiple **non-adjacent** token ids (離合詞). `LegEvidence.legId` is an **opaque string** the engine logs but never branches on (research: polyglot-sidecar-contract — capability declaration, not negotiation). |
| 2 | `SteeringPolicy<TAnn>` | Generation constraints (prompt-assembly hints), candidate scoring, and the anglicize-down operator. Clitic rules vs separable-verb/system-morpheme allowlist are *algorithms inside the pack*, not config data (research: nlp-precedents — ICU litmus: structure = swapped code). | `generationConstraints(plan: TurnPlan): PromptConstraints`; `scoreCandidate?(candidate: CandidateText, snapshot: UserSnapshot): number` — optional pack hook for pack-semantic ranking terms (zh register fit), defaults to 0; `anglicizeDown(stream: VerifiedToken<TAnn>[], directives: ScaffoldDirective[]): BlendedStream<TAnn>` — pure (deterministic on same inputs). Its TCK laws are the three properties both specs actually mandate (§4.2): subtraction-safety, allowlist inviolability, frame preservation. |
| 3 | `AnnotationCodec<TAnn>` | The per-language payload behind the shared token spine. Spine (`id, lang, kind, status, band, spanGroup?`) is contract-owned and **closed**; payload is opaque generic, Rollup-`meta` convention — Chinese tone tracks never appear as optional fields on Arabic tokens (research: plugin-architectures — namespaced payload; nlp-precedents — Fluent asymmetry). **The zod schema is the single canonical source**: the pack build *generates* its JSON Schema artifact (`ar-annotations.schema.json`) from it via `z.toJSONSchema` / zod-to-json-schema, with the same `git diff --exit-code` freshness gate the OpenAPI pipeline uses — TS-side and sidecar-side validation can never silently describe different shapes. | `schema: z.ZodType<TAnn>` (canonical; validated at wire/storage boundaries since generics erase); `schemaId: string` (e.g. `ar-annotations/v1`); encode/decode round-trip through JSON. Cached annotation payloads are **re-derivable**: a `schemaId` bump invalidates caches (the documented rule) — contrast learner state, which must *migrate* (§1.4). |
| 4 | `MasteryModel` | **The hardest seam — resolved in §1.4.** | Declared learnable-unit graph + pure functions; per-(dimension × unit) scaffold directives. |
| 5 | `CurriculumPolicy` | Per-turn selection inputs: unit inventories, eligibility, coverage floors. The engine owns the shared cascade (FSRS-due → topic-relevant in-band → curriculum-rank fallback) and the novelty budget; the pack supplies candidates and floor predicates. Chinese's dual floor (word comprehension + character decoding-load) is deferred to Phase 3 (v0 declares none — only the structural `DEFAULT_FLOORS` `makeSeedVocabBypassCurriculum` provides, same as ar) — see the dual-instance amendment; once implemented it is just its `floors` array having two entries the engine evaluates generically (research: ts-di-composition — floors as module-supplied predicates). | `candidates(userSnapshot, topic): Candidate[]`; `floors: CoverageFloor[]` where `CoverageFloor = { id: string; satisfied(candidateStream: TokenSpine[], snapshot): boolean }` — `candidateStream` is the **full candidate token stream** (the specs' floors are over the generated running text, not over the chosen new words). |
| 6 | `RendererManifest` | Keys into the client-side component registry: which component renders each `(lang, token.kind)` and each breakdown panel. Structural deltas (inline diacritic fade vs ruby-above-glyph + tone cue) = swapped components; value deltas (fonts, direction, spacing) = design tokens per Locale mode — the code mirror of the design-system-inheritance ADR (research: nlp-precedents — ICU BreakIterator "swapped algorithm behind one API"). Pack components are also the emitters of `LearningEvent`s (§1.4) — the breathe-down click on a single character inside a word panel is pack UI producing a pack payload on the contract event spine. | `{ direction: 'rtl'\|'ltr'; tokenRenderers: Record<TokenKind, ComponentKey>; breakdownPanel: ComponentKey }`; actual React components export from `@la/lang-<x>/react` and register in `src/apps/web`'s registry. Shared shell renders `<TokenRenderer token={t}/>` and imports zero language components. |
| 7 | `TtsDriver` | Synthesizes **only from the gate-verified surface form** (shared ordering, TCK law). Per-language: ar = verified vocalized string → Azure ar voices; zh = SSML phoneme override with surface pinyin + per-engine tone-digit adapter. | `synthesize(verified: VerifiedToken[], voice: VoiceConfig): Promise<TtsPayload>` — input type is `VerifiedToken`, making "TTS from unverified text" unrepresentable. |
| 8 | `SidecarDescriptor` | Declares the container image ref, required contract version, and expected `capabilities` response. The engine provisions and health-checks it; the pack only ever talks through the injected typed client (§3). | `{ imageRef: string; contractVersion: string; expectedLegs: string[] }`. |
| 9 | `AssetManifest` | Curriculum tables, verified-tuple stores, seed vocab: shared spine columns + language extension payload columns, named. Text-shaped assets live in-package; model-scale data lives in the sidecar image per the hosting ADR (research: monorepo-layout — spacy-lookups-data precedent). Assets are git-versioned and baked into the image, so boot validation checks **existence + spine-schema validity** — checksums defend against nothing git+Docker don't already guarantee, and return only if an asset is ever *fetched* rather than committed. | `{ assets: Record<AssetId, { path: string; spineSchema: z.ZodType }> }`. |

### 1.4 The mastery seam (seam 4): module-declared learnable-unit graph + per-(dimension × unit) scaffold directives

The failure mode to refuse: a shared mastery state shape. Arabic is one per-(user, lemma, sense) latent with FSRS + a status ladder + two fade tracks; Chinese is two coupled latents (word-FSRS "W" + per-character BKT "C") where **C gates the pinyin fade of W's tokens**, with three fade dimensions. Unit count, relations, and which unit gates which scaffold are all per-language. So the contract exposes **behavior and a declared graph, never internals** (research: nlp-precedents — Fluent asymmetry, "contract the OUTPUT"; contract-testing-tck — capability manifest over lowest-common-denominator; plugin-architectures — core owns lifecycle, pack owns semantics):

```ts
export interface MasteryModel {
  // — DECLARATION (data the engine + TCK read; drives storage + generic law tests) —
  unitKinds: UnitKindDecl[];
  //   UnitKindDecl = {
  //     kind: string;
  //     stateSchema: z.ZodType;
  //     stateVersion: number;                                  // learner state is durable and NOT re-derivable
  //     migrateState?(fromVersion: number, state: unknown): unknown;  // pure; total over all declared prior versions (TCK law)
  //     indexes?: Array<{ id: string; extract(state: unknown): string }>;  // pack-declared secondary indexes the
  //   }                                                        //   engine maintains at write time (e.g. ar 'root')
  //   ar: [{ kind:'lemma-sense', … , indexes:[{id:'root',…}] }]
  //   zh: [{ kind:'word', … }, { kind:'character', … }]
  fadeDimensions: FadeDimId[];
  //   ar: ['englishBlend','vowelFadeLexical','vowelFadeCaseEnding']   // the two vowel sub-tracks are two DECLARED
  //                                                                   // dimensions — iʿrāb is "the last wall"
  //                                                                   // (vocabulary-system.md §6) and the renderer
  //                                                                   // must know WHICH ḥarakāt to strip
  //   zh: ['meaning','segmentalPinyin','tone']
  gatingEdges: GatingEdge[];
  //   zh: [{ gatingUnitKind:'character', gatedDimension:'segmentalPinyin' }] ; ar: []
  creditLeakEdges: CreditLeakEdge[];              // CreditLeakEdge = { evidenceDimension: FadeDimId;
  //                                              //                    leakingDimension: FadeDimId }
  //   zh: [{ evidenceDimension:'meaning', leakingDimension:'segmentalPinyin' }] ; ar: []
  //   The declared CROSS-dimensional half of the leak law (§4.2) — added in contract v0 (#16)
  //   per the decision routed from the PR #15 review. Declared edges ADD protection on top of
  //   the universal same-dimensional half; they never replace it (ar declares zero edges and
  //   keeps full same-dimensional coverage). A self-edge is rejected by the manifest schema.

  // — BEHAVIOR (pack-pure functions; state is opaque to the engine) —
  unitsForToken(token: TokenSpine, ann: unknown): UnitRef[];   // zh maps one token → 1 word unit + N character units
  affectedUnits(events: LearningEvent[]): UnitSelector[];      // hydration hook: which ADDITIONAL units this evidence
                                                               //   touches, beyond the turn's tokens. UnitSelector =
                                                               //   UnitRef | { kind, index, value } — the index form
                                                               //   resolves via a declared secondary index, which is
                                                               //   how ar's LOCKED root-prior (vocabulary-system.md §8
                                                               //   decision 2: "head-start to siblings, never
                                                               //   auto-credit") reaches sibling lemma-units NOT
                                                               //   present in the turn.
  applyEvidence(events: LearningEvent[], states: UnitStateMap): UnitStateDelta[];
  scaffoldPlan(token: TokenContext, states: UnitStateMap): ScaffoldDirective;
  dueUnits(states: UnitStateMap, now: Date): UnitRef[];        // feeds the shared cascade
}

export interface ScaffoldDirective {
  fadeLevels: Array<{ dim: FadeDimId; unit: UnitRef; level: FadeLevel }>;  // keyed by (dimension × unit), NOT per token
  blend: BlendDecision;
  dueness: DueInfo;
}
export type FadeLevel = 'full' | 'partial' | 'faded';          // small contract enum; the TCK gating law reads it
                                                               // generically, packs interpret it
```

**Why (dimension × unit), not one level per dimension per token:** the Chinese spec fades segmental pinyin **per character within a word token** (chinese-instance-design.md §2.2: fade the surface-pinyin above a glyph only when P(known) for *that* character clears threshold; §3.1: an unmastered character inside an otherwise-mastered word still needs its segmental scaffold). Concretely: 銀行 is one token / one FSRS word-unit containing two character-units; with mastered 銀 and unmastered 行, a single token-level `segmentalPinyin` level must either strip 行's ruby (the exact failure the two-latent model exists to prevent) or keep 銀's forever. Per-(dim × unit) directives express it exactly: `[{dim:'segmentalPinyin', unit:銀, level:'faded'}, {dim:'segmentalPinyin', unit:行, level:'full'}]`. Arabic gets the mirror benefit for free: its lexical-vs-case-ending vowel split is two declared dimensions over the same lemma-sense unit, so the renderer knows which ḥarakāt class to strip without the engine understanding either.

**The learning-event spine (the return channel):** evidence flows from pack UI back to `applyEvidence` on a contract-owned envelope, mirroring seam 3's annotation envelope:

```ts
export interface LearningEvent {
  tokenRef: TokenId;
  unitRefs: UnitRef[];
  renderedScaffold: Record<FadeDimId, 'shown' | 'hidden'>;   // ECHO of the directive actually in force at render time
  payload: { schemaId: string; [k: string]: unknown };       // module-owned envelope — zh's per-character
}                                                            //   breathe-down click (chinese §2.4) rides here
```

The `renderedScaffold` echo exists because the zh leak-free credit rule (chinese-instance-design.md §2.3) grants meaning evidence **only on pinyin-hidden impressions** — the model cannot apply that rule unless the event says what the learner actually saw. The TCK enforces the leak law generically (§4.2), in its two halves: the **universal same-dimensional half** — evidence on a dimension whose own `renderedScaffold` was `shown` produces no delta for that dimension, for every fade dimension of every pack, no declaration needed — and the **declared cross-dimensional half** — for each declared `creditLeakEdge`, evidence on its `evidenceDimension` produces no delta when the `leakingDimension`'s scaffold was `shown` (the zh rule above, declared as `{ evidenceDimension:'meaning', leakingDimension:'segmentalPinyin' }`).

**Division of labor:** the engine owns the per-(userId, unitKind, unitId) tuple store — validating rows against each kind's declared `stateSchema` at its declared `stateVersion`, running `migrateState` on version-skewed rows at read, maintaining declared secondary indexes at write — plus the due-queue mechanics and a shared FSRS library packs *may* call via `PackContext`. The pack owns every semantic: Arabic implements `scaffoldPlan` with one FSRS state and three declared fade dimensions; Chinese implements the W⊗C coupling *inside* `scaffoldPlan` — it looks up the token's character-unit BKT states and emits per-character `segmentalPinyin` levels accordingly. **The engine never knows characters exist.** The declaration exists so that (a) the store can key, validate, index, and migrate state rows generically, and (b) the TCK can test gating *laws* over whatever graph is declared — "driving every gating unit to mastered drives its per-unit gated-dimension level to `faded`" — without knowing either language (research: contract-testing-tck — Jakarta capability-manifest transposition). Both languages verified against this shape: ar = 1 kind (with a `root` index), 3 dims, 0 edges; zh's full design is 2 kinds, 3 dims, 1 edge, with the gating edge deferred to Phase 3 (v0 declares `gatingEdges: []`, same as ar — see the dual-instance amendment). No core change for either; language N with a third topology extends its own declaration.

**Durable-state evolution is part of this seam, not an afterthought.** The product's entire value is longitudinal learner state; annotations can be re-derived from text, learner state cannot. Hence `stateVersion` + optional pure `migrateState` per unit kind now, while it is two interface fields — with the TCK law (§4.2) that declared-version state round-trips and `migrateState` is total over all declared prior versions. The moment lang-zh lands and the contract freezes to 1.0 is exactly the moment users start accruing state; that day must not be the day we discover there is no evolution path.

What we explicitly do **not** do: parameterize a shared mastery engine by "number of latents" or interpret the graph as executable config — ICU's lesson is data for values, swapped code for structure; a "mastery engine configured by JSON" is an inner platform (research: nlp-precedents — anti-pattern "making structural deltas data-driven").

### 1.5 The shared core it plugs into

Engine-owned, language-blind, imports only `@la/contract`:

- **Conversation loop / hot path** — the generic per-turn shape is **candidates(1..N) → cheap-rank → gate the winner**: `curriculumPolicy` cascade + novelty budget select targets → LLM generates N candidate texts under `steeringPolicy.generationConstraints` → rank candidates by declared floors evaluated over each candidate token stream, novelty conformance, due-review coverage, and `scoreCandidate` (pack term, e.g. zh register fit) → `verificationGate.verify({targetText, intents})` on the winner returns the banded token stream → `masteryModel.scaffoldPlan` stamps per-(dim × unit) `ScaffoldDirective`s onto each token's envelope → `steeringPolicy.anglicizeDown` → `annotationCodec.encode` → SSE emit. On unrepairable RED, promote the next-ranked candidate / regenerate. **N=1 in the walking skeleton** (single-shot + regenerate-on-miss, per epic #3's AC); both committed specs lock oversample-and-rank N=3–5 (vocabulary-system.md §8 decision 1; chinese-instance-design.md §5.2) so the loop's shape — and #9's E2E/SSE contract — accommodates N>1 without rework.
- **The RED law, scoped:** **no RED token in a GENERATED display stream**; substitution / English-fallback is the only sanctioned repair *on the generation path*. The future **authentic-ingestion** surface (chinese-instance-design.md §5.4 — un-generated text the author's hand wrote) shares the gate port but carries its **own pack/pipeline-owned RED policy**: scaffold-up, display flagged as unresolved, excluded from mastery accounting — the text may not be altered. That surface is named here precisely so nobody later "fixes" zh ingestion to satisfy a mis-scoped law.
- **Scaffold stamping, not a "blend engine":** there is deliberately **no engine component that "applies" fade levels** — applying `tone` or `vowelFadeCaseEnding` *is* pack renderer/anglicize semantics, and a generic engine loop over declared dimensions has no implementable behavior. The turn loop stamps the pack's directives onto the token envelope verbatim; the only consumers of a directive are pack code: `anglicizeDown` and the pack's `/react` components.
- **Learning-event route** — one shared client→server endpoint carrying `LearningEvent`s (§1.4). The engine hydrates `UnitStateMap` from `unitsForToken` over the turn's tokens **plus** `affectedUnits(events)` selectors resolved against the tuple store's declared indexes, calls `applyEvidence`, validates and persists the deltas.
- **Scheduler cascade** — shared ordering + novelty budget; per-language inputs via port 5; floors evaluated generically over candidate token streams.
- **SSE schema** — the token spine (including `spanGroup`) + `annotations: { lang, schemaId, payload }` envelope + stamped `ScaffoldDirective`s; spine fields are the only thing shared client code touches.
- **Tuple-store spine** — shared columns (userId, unitKind, unitId, stateVersion, state JSONB validated by declared schema, FSRS fields where the pack opts in) + declared secondary index columns + extension payload columns; `migrateState` applied on read of version-skewed rows.

---

## 2. Config-driven composition

### 2.1 Decision: Pure DI composition root, no container

`composeApp(config: InstanceConfig): App` — a hand-rolled, pure function; constructor/factory injection; no Awilix, no Inversify, no decorators. Justification for **this** project (research: ts-di-composition, all four container recommendations):

1. The object graph is **static per deployment** (one language per instance) and tiny (~9 ports + a handful of engine services). Containers are "optional until 20–30+ tangled services"; we have nowhere near that.
2. Decorator DI (Inversify/tsyringe/Nest-style) is a 2026 toolchain trap: legacy `emitDecoratorMetadata` vs Stage-3 decorators, breaks under esbuild/SWC, Inversify v6→v7 churn — plus Nest is documented multi-week ceremony for 1–2-person teams, which the operator ruled out.
3. A **pure** composition function is the drop-in test's unit: CI calls `composeApp(arConfig)` and `composeApp(zhConfig)` and runs the identical suite. Container registrations resolve lazily and hide composition errors until first resolution — exactly wrong for a boot-fail-fast design.
4. The escape hatch is documented: if the root ever becomes unreadable, migrate mechanically to Awilix strict-mode (same constructor-injection style) — never to decorators.

All env/config reading happens **outside** `composeApp`; it takes a validated config object only (research: ts-di-composition — anti-pattern "reading env deep inside modules kills the dual-CI test").

### 2.2 Instance config + derived capabilities

Two zod-validated layers (research: plugin-architectures — Strapi/Payload "config is validated data; composition is code"):

```ts
// instance config — parsed from env/file at boot, before composeApp
const InstanceConfig = z.object({
  language: z.enum(['fake', 'ar', 'zh']),
  sidecar: z.object({ baseUrl: z.string().url(), mode: z.enum(['real','fixture','mock']).default('real') }),
  assetsRoot: z.string(),
  tts: z.object({ provider: z.string(), voice: z.string() }),
});
// no featureFlags field: no flag exists yet; add the field with its first named consumer, not before
```

The pack manifest (`meta` + the nine ports, §1.2) is the second layer, validated against `@la/contract`'s schema when the pack loads. Capabilities are **derived, never declared**: `deriveCapabilities(pack)` computes `{ direction, masteryUnitKinds, fadeDimensions, gatingEdges, coverageFloorIds, sidecarImage, requiredDataAssets }` as a pure function over the ports — one source of each fact inside the package, with the cross-*process* check (engine vs sidecar `/v1/capabilities`) preserved at boot, which is the only place two independent sources genuinely exist.

### 2.3 The composition root

```ts
// the ONLY place in the codebase that names languages
const registry: Record<LanguageId, () => Promise<{ pack: LanguagePack }>> = {
  fake: () => import('@la/lang-fake'),
  ar:   () => import('@la/lang-ar'),
  zh:   () => import('@la/lang-zh'),
};

export async function composeApp(config: InstanceConfig): Promise<App> {
  const { pack } = await registry[config.language]();          // literal specifiers — typed, lazy, tree-shakeable
  assertEqual(pack.meta.contractVersion, CONTRACT_VERSION);    // exact equality; in-tree lockstep needs no ranges
  PackManifestSchema.parse(pack);                              // manifest shape
  const caps = deriveCapabilities(pack);                       // pure function over the ports (§2.2)
  await assertAssetsPresent(pack.assetManifest, config.assetsRoot);  // every named asset exists + spine-schema-valid
  const sidecar = createSidecarClient(config.sidecar.baseUrl); // generated typed client (§3)
  await assertSidecarAgrees(sidecar, caps);                    // GET /v1/capabilities: lang, contractVersion, legs
  const ctx = makePackContext(sidecar, assetReader(pack, config), fsrsLib, logger, config);
  return wireEngine(pack, ctx, config);                        // plain constructor calls; ~30 lines
}
```

Literal-specifier dynamic imports, never `import(config.modulePath)`: computed specifiers are untyped, defeat tree-shaking, and fail at runtime instead of compile time; the exhaustive `Record<LanguageId, …>` makes adding language N a compiler-checked one-line edit (research: ts-di-composition — MDN/TS dynamic-import guidance; requires `module: nodenext`). Every validation failure is a **boot failure with a named-seam error**, never a runtime undefined three layers into the gate (research: plugin-architectures — fastify-plugin registration-time validation; nlp-precedents — spaCy "no hidden defaults").

Honest reading of "zero changes outside config": adding language N = new packages + **one registry line** + config. The registry line lives in the composition root, is compiler-forced, and is the deliberate alternative to runtime plugin scanning (research: monorepo-layout — explicit static registry over discovery). The epic states this precisely (§5.3).

### 2.4 The zero-changes guarantee as enforceable rules

Convention doesn't survive agent-built PRs; these are CI gates (research: nlp-precedents — spaCy #1816: ONE hardcoded lookup path silently defeated the whole plugin architecture):

1. **Package graph (pnpm strict resolution):** `src/packages/engine` and `src/packages/contract` do not declare `@la/lang-*` deps → the import physically cannot resolve.
2. **dependency-cruiser in CI, four rules:** (a) `engine|contract` → `lang-*` forbidden; (b) no deep imports across package roots (entry points only); (c) `contract` has zero workspace deps; (d) no cycles. `tsPreCompilationDeps: true` so `import type` leaks are caught too (research: monorepo-layout).
3. **`exports` maps** on every package: deep imports (`@la/lang-ar/src/internal/dediac`) fail at resolution; the public surface *is* the contract.
4. **No language conditionals in core:** ESLint rule + CI grep forbidding `lang === '` / `language ===` matches under `src/packages/engine`, `src/apps/server/src` (composition root file excepted), `src/apps/web/src/shell`. Leg IDs and derived-capability fields are the sanctioned alternative.
5. **The behavioral detector:** the CI drop-in matrix itself (§4.3) — any `if (lang…)` that slips past static checks shows up as an ar-vs-fake-vs-zh asymmetry in the shared suite.

---

## 3. The polyglot boundary (sidecar HTTP contract)

### 3.1 Scope discipline

The sidecar contract covers **seams 1 + 3 and the verified-surface-form input to 7, plus the image-selection half of 8/9 — only**. Mastery, curriculum, steering, and rendering stay TS-side injected modules: putting the hardest seam behind HTTP would buy nothing and make the drop-in test slower and flakier (research: polyglot-sidecar-contract — "the sidecar is the Python-NLP boundary, not the language boundary"; KServe scope discipline).

### 3.2 Spec-first, one document

`src/packages/contract/sidecar/openapi.yaml` — **hand-authored OpenAPI 3.1**, the single source of truth. Never FastAPI code-first: letting the Arabic sidecar's emitted `/openapi.json` be the spec makes the first implementation's accidents the contract, and "zh conforms" silently means "zh imitates ar" (research: polyglot-sidecar-contract). Both sides are generated from it:

- Python: `datamodel-code-generator` → Pydantic v2 models each sidecar's FastAPI routes must type against.
- TS: `openapi-typescript` + `openapi-fetch` → the typed client the engine consumes.
- CI: regenerate + `git diff --exit-code` (freshness), plus an **oasdiff breaking-change gate** — a breaking spec change without a major bump fails the PR.

This document + both codegen pipelines + the Prism compose profile land as the **spec-first opening PR of #7** (§5.2) — before any FastAPI code, so the Arabic implementation types against the contract rather than emitting it.

### 3.3 Endpoints (KServe Open Inference Protocol anatomy)

| Endpoint | Purpose |
|---|---|
| `GET /healthz` | Process live; cheap; never touches models. Liveness probe. |
| `GET /readyz` | 200 only when ALL declared heavy assets are loaded (CAMeL DB; torch+g2pW warm). **The load-bearing endpoint:** Cloud Run multi-container dependent startup *requires* a startup probe here, with `failureThreshold × periodSeconds` sized to worst-case warmup (minutes-scale for zh torch) (research: polyglot-sidecar-contract — Cloud Run probes). |
| `GET /v1/capabilities` | Static declaration: `{ language, contractVersion, verificationLegs: [...opaque legIds], annotationSchemaId, features }`. The engine validates `contractVersion` and that `language` matches the instance config at boot, and cross-checks against `deriveCapabilities(pack)` — deploy-time skew fails readiness. The engine **never branches on `language`**; leg names flow through as opaque evidence labels (research: polyglot-sidecar-contract — LSP/MCP declaration-half only). |
| `POST /v1/verify` | The gate, **text-in/tokens-out**: `{ targetText, intents }` in → the banded token stream out (per-token spine + band + leg evidence + canonical annotations; `spanGroup` ids for discontinuous units). Segmentation, boundary voting, and span minting happen **inside** — token boundaries are gate output, mirroring port 1 exactly. |
| `POST /v1/annotate` | Annotation payloads for already-verified tokens (may collapse into `/verify` if the Arabic skeleton shows they always travel together — a permitted additive simplification before 1.0). |

### 3.4 The extension-payload pattern

The shared spec types everything language-agnostic **strictly** (token ids, lang, kind, status, band, spanGroup, `evidence: [{legId, pass, detail}]`). The per-language payload rides one envelope field:

```yaml
annotations:
  type: object
  required: [lang, schemaId, payload]
  properties:
    lang:     { type: string }
    schemaId: { type: string }        # e.g. "zh-annotations/v1"
    payload:  { type: object }        # validated against the MODULE-OWNED, GENERATED JSON Schema
```

Each language module ships the JSON Schema for its payload — **generated from its canonical zod schema** (§1.3 seam 3) in the pack build, freshness-gated in CI (`ar-annotations.schema.json`: diacritized form, bare skeleton, vowelState, root+pattern; `zh-annotations.schema.json`: citation+surface pinyin, ruby units, tone track, radical breakdown, bound-morpheme flags, discontinuous separable-verb span groups). The sidecar's conformance fixtures validate against the generated artifact, so one shape governs both sides of the wire. Payload validation happens in the module's conformance suite and at the engine's module boundary — not in the shared spec. Explicitly rejected: a closed `oneOf` + discriminator over languages in the shared spec, because adding language N would then edit the shared contract — the exact non-drop-in edit the requirement forbids — and discriminator tooling is uneven anyway (research: polyglot-sidecar-contract — Bump.sh). Equally rejected: a bare `additionalProperties: true` blob with no schema behind it — the envelope must always resolve to a concrete versioned module-owned schema.

### 3.5 Versioning — the wire half and the data half

**Wire:** `/v1` path prefix; the contracts package is semver'd; **additive-only within a major**; `contractVersion` reported by `/v1/capabilities` and asserted equal at boot; oasdiff gates PRs. No header versioning, no runtime multi-version support — engine and sidecar deploy together, lockstep-with-a-diff-gate suffices (research: polyglot-sidecar-contract).

**Durable data — the expensive half for an in-tree lockstep monorepo:** two explicit rules. (1) **Cached annotation payloads are re-derivable**: bumping a pack's `schemaId` invalidates every cached/stored payload under the old id; re-derivation from stored text is the migration. (2) **Learner state is NOT re-derivable**: it evolves via `stateVersion` + `migrateState` per unit kind (§1.4), covered by its own TCK law (§4.2). A pack PR that revs a `stateSchema` without a migration is a contract violation the TCK catches, not a production read-time crash.

### 3.6 Dev/CI stubs at the right altitude

- **Prism mock** (`stoplight/prism` docker image) serves the spec as the "null sidecar" — compose profile `mock` lets #9 (hot path) and frontend work proceed with zero Python, and Prism's request-validation mode checks the *engine's outbound requests* against the contract too.
- **Fixture-backed fake inside the real sidecar** for zh: a build/env flag (`SIDECAR_MODEL_MODE=fixture`) swaps **only the torch-loaded g2pW model** for a lookup table keyed on (sentence, token) pairs derived from the golden corpus. CEDICT/Unihan membership, the multi-segmenter vote, the sandhi resolver, the FastAPI routes, Pydantic validation, and container packaging all run **real**. Never mock the sidecar wholesale in the drop-in test — that proves only that the server can talk to your own mock (research: contract-testing-tck — Eugene Yan / fake-at-the-model-inference-seam; polyglot-sidecar-contract — "stub the MODELS, not the service").
- Arabic (deterministic CAMeL) runs fully real in CI — the always-real matrix leg.
- The same altitude discipline applies to the **LLM generation step**: a replay/fixture LLM client (recorded structured-output responses keyed per matrix leg, maintained with the same golden-corpus discipline) makes the PR-blocking E2E fully deterministic (§4.3) — live-generated novel sentences would always miss the zh fixture-g2pW lookup table, forcing either a leg failure or a silently-vacuous agreement leg.

---

## 4. The TCK / dropinability testing

### 4.1 Package: `@la/lang-conformance`

Exports a parameterized Vitest suite — the Jakarta-TCK pattern scaled down: `describeLanguagePack(name, makePack, { fixtures, fakes })`. Each pack's own `test/conformance.test.ts` is ~10 lines instantiating it. The TCK **depends only on `@la/contract`** and lives in its own package — never inside engine (fixtures shaped like real languages would tempt engine imports) and never inside the first language built (the dependency arrow would then point core→arabic) (research: contract-testing-tck; monorepo-layout).

### 4.2 Test categories, tied to the seams

| Category | Seam | Mechanism |
|---|---|---|
| **Gate refuses wrong forms** | 1 | Per-language golden corpora: ~50–200 curated cases, `(targetText + intents in) → (expected token stream + bands + canonical annotation JSON)`, one focused case per file, stable-key-order pretty-printed JSON so diffs are auditable. ar probes: dediac round-trip failures, wrong-sense lemma. zh probes: sandhi surface vs citation, segmenter boundary disagreement (including re-segmentation differing from a naive split), separable-verb discontinuous span groups. Same assertion code over every corpus (research: contract-testing-tck — golden-fixture discipline; nlp-precedents — UAX/CLDR fixture-file conformance). |
| **Anglicize respects constraints** | 2 | Fixtures with explicit should-NOT cases (never split clitics; never anglicize a classifier/aspect particle) + **fast-check laws**, the three properties both specs actually mandate: (a) **subtraction-safety** — the output's target-language token multiset is a subset of the input's (no target byte minted); (b) **allowlist inviolability** under *any* generated mastery snapshot; (c) **frame preservation** — non-anglicized tokens keep order and content. `anglicizeDown` is pure (deterministic on same inputs); it is *not* idempotence-lawed — its input (`VerifiedToken[]`) and output (`BlendedStream`) types deliberately differ, which is what keeps "TTS from unverified text" unrepresentable. Plus: **no RED token in a GENERATED display stream** (scoped per §1.5 — the authentic-ingestion surface carries its own RED policy and is exempt by construction). |
| **Annotation schema validity** | 3 | Every emitted payload validates against the pack's declared `schemaId` schema; round-trips through JSON; spine fields always present; the generated JSON Schema artifact is fresh against the canonical zod schema (`git diff --exit-code` in CI). |
| **Mastery-graph laws** | 4 | Generic over the *declared* graph: state for every declared unitKind serializes/round-trips against its schema at its declared version; `migrateState` is total over all declared prior versions and migrated state validates; `applyEvidence` is pure; for every declared gating edge, driving **every gating unit** to mastered drives its **per-unit** gated-dimension level to `faded`; **the leak law**, in both halves — *universal same-dimensional* (runs for every fade dimension of every pack, no declaration needed: evidence on a dimension whose own `renderedScaffold` was `shown` produces no delta for that dimension — a pack declaring zero `creditLeakEdges`, like ar, keeps this full coverage) and *declared cross-dimensional* (for every declared `creditLeakEdge { evidenceDimension, leakingDimension }`, evidence on the evidence dimension produces no delta for it when the leaking dimension's scaffold was `shown`; declared edges ADD protection on top of the universal half, never replace it); `dueUnits` monotone under time. Runs unchanged for ar's 1-kind indexed graph and zh's 2-kind graph declared with 0 edges in v0 (the gating edge is deferred to Phase 3, same as ar's floor deferral — see the dual-instance amendment); the full 2-kind **gated** graph is proven non-vacuously pre-zh by `lang-fake`'s analog edges — this is the executable proof the hardest seam abstraction holds (research: contract-testing-tck — test declared capabilities). |
| **Curriculum laws** | 5 | Cascade ordering respected; for any generated candidate pool, the winning candidate's token stream never violates a declared floor (zh declares none in v0 — its dual budget floor is deferred to Phase 3); novelty budget honored; `scoreCandidate` deterministic. |
| **Renderer contract** | 6 | One shared portable-stories file written against the contract (states: each band × fade stage × mastered/fading/new, including a per-unit split-fade state and a discontinuous-span token), instantiated per language with that language's fixture tokens; asserts render-without-error, band colors match `tokens.json`, `dir`/bidi isolation on the RTL leg, ruby present only in zh. Visual snapshots per-language only (an RTL/LTR shared snapshot is meaningless) (research: contract-testing-tck — portable stories). |
| **Sidecar conformance** | 1/3/8 | **Schemathesis** property-fuzz against every built image from the one OpenAPI doc (crashes, schema violations) + the golden HTTP fixtures run black-box via `probeSidecar(baseUrl)` against `docker run` of each image — the hosting ADR's "identical gate probes" move promoted to a permanent CI leg (research: polyglot-sidecar-contract; monorepo-layout). |

### 4.3 The CI drop-in matrix

GitHub Actions `strategy.matrix` over language configs; **the same workflow definition, the same E2E turn script, the same TCK** per leg (research: contract-testing-tck):

```
matrix.lang = [fake, ar, zh]        # all three from the walking skeleton (operator decision 2026-07 — see the dual-instance amendment below)
```

- **`fake` leg — `@la/lang-fake` is the MAX-topology fixture, not the minimal one.** A fake that shares zero code with Arabic but shares Arabic's *shape* would prove only that the engine boots without importing lang-ar — none of the ar-biased contract assumptions zh will actually break. So the fake is deliberately the hardest topology the contract claims to support, still fully deterministic and dependency-free (a few hundred lines, once): its gate **re-segments its input** (returns different token boundaries than a naive split); it declares **2 unit kinds + 1 gating edge + 3 fade dimensions**, at least one faded **per-unit** within a token; it emits at least one **discontinuous span group**; and it deterministically produces **YELLOW and RED** cases the shared E2E script must handle (RED exercising the promote/regenerate repair path). This converts the fake leg from a boot smoke-test into a real contract detector — it is what makes the pre-zh "drop-in is a tested property" claim honest.
- **`ar` leg** — real sidecar image (deterministic CAMeL, no fake needed).
- **`zh` leg (later)** — real image with `SIDECAR_MODEL_MODE=fixture` (§3.6).
- **The PR-blocking E2E is fully deterministic**: fixture/replay LLM client (recorded structured-output responses per leg, §3.6) + real (ar) / fixture-model (zh) sidecar. No live model call — LLM or g2pW — sits on the blocking path.
- Each leg: compose via the shared docker-compose profiles → boot `composeApp(config)` → run (1) the E2E turn script (learner message → rendered tutor turn where every target token is banded, annotations validate, TTS payload derives from the verified form, YELLOW/RED paths exercised), (2) the TCK, (3) Schemathesis + golden HTTP probes.
- **Scheduled non-blocking jobs** (nightly/weekly): (a) run the *real* g2pW image over the golden corpus and diff against the fixture lookup table; (b) run the live-LLM end-to-end turn against each real leg. Both are drift detectors that keep the fixtures honest — deliberately off the blocking path so their nondeterminism and cost never gate PRs, and deliberately alarmed so fixture rot is visible (research: contract-testing-tck).
- The TCK runs on **every PR**, both legs — never one-time certification (research: contract-testing-tck — anti-pattern).

### 4.4 Publishing a new language module = the checklist

1. `@la/lang-N` package: manifest + nine ports, passing `describeLanguagePack`.
2. Canonical zod annotation schema (JSON Schema artifact generated in-build) + golden gate corpus + steering fixtures + recorded LLM replay responses for its matrix leg.
3. Sidecar image honoring the shared OpenAPI (Schemathesis green) with honest `/readyz`. (Fixture mode for neural weights is dormant until the zh neural-legs follow-up: the zh v0 sidecar is deterministic-legs-only and runs directly in the matrix like ar.)
4. `/react` subpath components + the shared stories instantiated.
5. One registry line in the composition root; one matrix leg; instance config.
6. `contractVersion` equal to the tree's `CONTRACT_VERSION` and green at boot; declared `stateVersion`s with migrations if revving. **Nothing else touched** — and CI, not review vigilance, enforces it.

---

## 5. Repo layout + walking-skeleton mapping

### 5.1 Layout (pnpm workspace)

```
src/
  packages/
    contract/          # types + zod + manifest schema + sidecar openapi.yaml + codegen config; ZERO workspace deps
    engine/            # turn loop, scheduler cascade, tuple store (indexes + migrations), FSRS lib; depends ONLY on contract
    lang-fake/         # permanent MAX-topology drop-in fixture pack (§4.3)
    lang-ar/           # ports impl; /react, /assets subpath exports
    lang-zh/           # (later) same shape
    lang-conformance/  # the TCK; depends ONLY on contract
  apps/
    server/            # composition root + config parse; the ONLY package depending on lang-*
    web/               # shell + component registry; imports lang-*/react only
  sidecars/
    ar/  zh/           # Python, outside pnpm workspace globs, own pyproject; images per hosting ADR
infra/                 # Terraform; ONE `language` var drives sidecar image + LANGUAGE env (+ the registry key by convention)
```

*Path re-anchor (2026-07-02, operator layout directive — issue #6 amendment): all product code lives under `src/` (`src/packages/*`, `src/apps/*`, `src/sidecars/*`); `infra/` stays a top-level sibling reserved for #11's Terraform tree. Package NAMES (`@la/*`) are unchanged; every path in this document reads `src/…` accordingly.*

`workspace:*` internal deps; pnpm catalogs pin zod/react/vitest so the two lang packages can never drift onto different zod majors — schema identity is load-bearing (research: monorepo-layout). Deploy: `pnpm deploy --filter @la/server --prod` multi-stage image; both lang packs present in the server image (small TS; the registry's lazy import means the unselected one never loads); per-language weight lives in the sidecar image only.

### 5.2 Epic-child mapping (what each implements vs stubs)

The original single "#6 grows into the contract's birthplace" plan was 4–6 reviewed agent PRs wearing one issue number, with the TCK double-claimed. Split with **exclusive ownership** — each child below is one reviewable unit, and no deliverable appears in two children:

**#5 (RTL spike)** — unchanged; its findings feed `lang-ar/react` and DESIGN.md, not the contract.

**#6 (scaffold)** — now a true scaffold, nothing more: the pnpm workspace + package graph above; base CI workflow skeleton; dependency-cruiser 4-rule config + the no-`lang===` lint; docker-compose skeleton with `mock`/`ar`/`zh` profile stubs. Done = the boundary rules exist and fire before any package has content worth protecting.

**NEW child `contract-v0` (number at filing)** — exclusively owns: `@la/contract` v0 — the nine port types with **text-in/tokens-out `verify`** (blocker fix; this is the cheapest moment to fix the dependency direction, before golden corpora and codegen cement the wrong shape), token spine with `spanGroup`, annotation + `LearningEvent` envelopes, per-(dim × unit) `ScaffoldDirective`, mastery-graph declaration types with `stateVersion`/`migrateState`/`indexes`, manifest zod schema — plus `composeApp` + the literal-import registry + boot validation (equality contract check, derived capabilities, asset existence + spine validation) and **`@la/lang-fake` as the max-topology fixture** (§4.3). Depends on #6.

**NEW child `lang-conformance-tck` (number at filing)** — exclusively owns: `@la/lang-conformance` (describe-factory, fast-check laws including gating/leak/migration and the anglicize triple, golden-fixture harness, `probeSidecar`), the GH Actions drop-in matrix (fake + ar legs; fake leg green is *this* child's done-criterion), and the scheduled drift-job skeletons (real-g2pW diff + live-LLM E2E; disabled until their targets exist). Depends on `contract-v0`. It is cross-cutting across #7/#9 and deserves its own review gate; sequence its harness before #7's image lands and its ar leg with #7/#9.

**#7 (Arabic sidecar)** — opens with the **spec-first PR**: `src/packages/contract/sidecar/openapi.yaml` (text-in/tokens-out `/v1/verify`), both codegen pipelines, regenerate-diff CI + oasdiff gate, and the Prism `mock` compose profile — then implements the shared spec for real: FastAPI routes typed against generated Pydantic models; `/v1/capabilities` declaring `['dediac-roundtrip','camel-morph']`; `/readyz` honest about CAMeL DB load; Cloud Run startup probe sized to it (hosting ADR prune list); Schemathesis green; ships the Arabic golden gate corpus + the generated `ar-annotations.schema.json`. The contract tests it passes are **the spec the future zh image builds against**.

**#8 (seed vocab)** — lands as `@la/lang-ar/assets` per the AssetManifest shape (spine columns + ar extension payload), loaded via the scoped asset reader with boot-time existence + spine-schema validation. Small change from its current framing: the asset format is contract-defined, not ad-hoc.

**#9 (hot path)** — implements the engine turn loop **purely against contract ports**, with lang-ar's gate/steering bound at the root. Epic #3 scopes OUT the learner model, blend advancement, and vowel fade, and scopes IN a *fixed* blend ratio — so in the skeleton, `composeApp` binds a **`FixedRatioScaffold`** behind the seam-4 port (constant directives, no state reads) and **bypasses the cascade behind seam 5** (seed-vocab known-set only, per epic AC); the seam-4/5 TCK categories run only against lang-fake until Phase 3 wires real mastery. The ports exist in contract v0; **their Arabic implementations are explicitly NOT this epic.** The loop is built to the generic candidates→rank→gate shape with N=1 (§1.5), so oversample-and-rank later changes a constant, not the SSE contract. Deliverables also include: the **LLM replay/fixture client** + recorded responses for the fake and ar legs (what makes the blocking E2E deterministic, §4.3), and the shared E2E turn script — **written against the contract, not against Arabic**, handling the fake leg's YELLOW/RED cases. Reviewer gates: compiles against `lang-fake` alone; zero `lang ===` branches; consumes only the generated TS sidecar client (can start against Prism before #7's image merges). Stubbed: mastery persistence beyond in-memory (behind the tuple-store interface), TTS driver (interface only, canned payload).

**#10 (renderer)** — implements the client component registry keyed by `(lang, kind)` over the SSE token spine + envelope, consuming **per-(dim × unit)** `ScaffoldDirective`s; `@la/lang-ar/react` (RTL bidi-isolated container, inline diacritic-fade token honoring the two declared vowel dimensions, root/pattern breakdown panel); the shared learning-event route emitting `LearningEvent`s with the `renderedScaffold` echo; lang-fake's renderer entry **proves the structural swap** with a second registry entrant and must render the fake's per-unit split-fade, discontinuous-span, YELLOW, and RED states; instantiates the shared portable-stories suite for the ar leg. This is the code mirror of the design ADR's modes-vs-swapped-components split.

**#11 (deploy)** — one Terraform variable `language = "ar"` drives sidecar `image = ".../sidecar-${var.language}"` + `LANGUAGE` env so the three coordinates cannot skew; startup probe on `/readyz`; `pnpm deploy` server image. No per-language server images.

### 5.3 What the epic must be told

**Epic #3 amendments to state explicitly:** (a) child #6 narrows to the true scaffold; two new children (`contract-v0`, `lang-conformance-tck` — file them, don't guess numbers; the repo's issue counter has moved past this document) carry the contract, the fake, and the TCK with **exclusive deliverable ownership** as mapped in §5.2 — no deliverable named in two children; (b) "zero changes outside config" is formally "config + one compiler-checked registry line + the language's own packages," enforced by §2.4's gates; (c) #9's reviewer instructions: compiles against lang-fake alone, binds `FixedRatioScaffold` + the seam-5 bypass — real mastery/curriculum implementations are out of this epic's scope, consistent with the epic's own scope-out; (d) contract v0.x may break freely until zh lands (§7), but every break migrates fake+ar in the same PR — the matrix enforces this automatically; (e) the RED-repair law is scoped to generated streams (§1.5) so the future zh ingestion surface is not born a contract violation.

(The zh matrix leg, zh fixture corpus, and zh recorded LLM responses are **not** children of this epic — they belong to the future zh epic, which must also include a real-model acceptance pass, §7 risk 3.)

---

## 6. YAGNI guardrails

Deliberately **not** built now:

- **No DI container** (Pure DI; Awilix is the documented mechanical escape hatch — research: ts-di-composition).
- **No runtime language switching / polyglot process** — one language per instance at build/deploy time; nothing precludes it later (the graph is a pure function of config), but no code serves it.
- **No plugin discovery** — no node_modules scanning, no entry points, no side-effect registration; the explicit registry map is the whole mechanism (research: monorepo-layout, plugin-architectures).
- **No hook bus, no ordering machinery** — one driver per seam; if a future language composes verifier legs, that composition lives inside its pack, invisible to the engine (research: plugin-architectures — Vite ordering RFC as the cautionary tale).
- **No Pact broker** — one operator, one consumer; the OpenAPI + Schemathesis + golden fixtures cover it; fixtures kept in pact-compatible request/response JSON shape as the cheap door-opener (research: polyglot-sidecar-contract, contract-testing-tck).
- **No behavior-inheritance chains** (`zh extends CJKBase`) — flat packs sharing library functions; ICU calls its own fallback machinery "bolted on" (research: nlp-precedents).
- **No per-language server images, no postinstall asset downloads, no `src/packages/shared` grab-bag** (research: monorepo-layout — anti-patterns).
- **No contract surface neither ar nor zh needs** — no optional methods "Japanese might need."
- **And, applying the same test to this document's own earlier draft:** no declared `capabilities` block (derived from the ports, §1.2); no semver-*range* contract checking (equality assert; ranges return if a pack ever leaves the tree); no sha256 checksums on git-versioned baked-in assets (existence + spine-schema validation only, until an asset is ever fetched rather than committed); no `featureFlags` field (add it with its first named consumer). Each was machinery whose flexibility had no second implementation.

**The two-implementation rule:** a seam earns generic contract surface only when **two concrete languages** demonstrate the delta — which is why the nine seams qualify *now* (each is justified twice over by the committed specs) and nothing else does. The rule cuts both ways: it is also why oversample-and-rank, per-(dim × unit) directives, evidence propagation via declared indexes, and the ingestion-scoped RED law *did* earn surface — each is locked in both committed specs — and why the four items above lost theirs. When language 3 arrives with a surprise, it goes first into its extension payload / declaration; only if a *second* language needs the same thing does the shared contract widen — via a contract-package semver bump, a TCK addition covering the new surface, and same-PR migration of all in-tree languages (the matrix enforces the last part automatically) (research: contract-testing-tck — lockstep versioning; plugin-architectures — "growing the contract is a deliberate versioned change, never 'just add a hook'").

---

## 7. Risks

1. **Over-abstraction cost.** Nine ports + a TCK + codegen for a product with zero shipped code is real weight; the walking skeleton gets slower to first-deploy. Mitigations: every port is a thin interface derived from a *committed spec delta*, not speculation; no framework, no container, no runtime machinery — the abstraction is types + one pure function + lint rules, most of it deletable in an afternoon if wrong; the §5.2 split keeps each child one reviewable unit so the weight lands as small PRs, not one balloon. The operator has explicitly chosen to pay this now; the alternative (retrofit the seam under a shipped Arabic product) is the documented spaCy pre-#3080 failure mode.
2. **Contract churn while pre-code.** The contract is being drawn from specs, not running code; #7/#9 will discover its v0 is wrong in places. Mitigation: hold at **v0.x with breaking changes explicitly allowed** until the zh pack lands — which is now *inside this epic* (dual-instance amendment), so the churn window closes at epic end; the cost of a break is bounded to "migrate fake + ar + zh in one PR," which the matrix mechanizes (three legs, honestly costlier per break than two). Freeze to 1.0 + additive-only discipline the day lang-zh is real — and the `stateVersion`/`migrateState` machinery (§1.4) exists precisely so post-1.0 evolution of *durable learner state* is survivable, not just wire evolution. Anti-goal during churn: silently mutating the OpenAPI — the oasdiff gate stays on even at v0 so every break is at least *visible*.
3. **Fixture fidelity (zh models AND the LLM replay client).** Any fixture can rot into false confidence: a g2pW fake returning tone-1 everywhere, or replay LLM responses drifting from what the live model actually emits, makes CI green while real paths go dead. Mitigations: fakes must return corpus-derived, varied outputs (a TCK assertion, not a convention); the scheduled non-blocking jobs diff fixture vs real — g2pW over the golden corpus, and the live-LLM E2E over each real leg — and file drift (§4.3); the fakes sit at the model-inference seam so every deterministic leg still runs real code around them. Residual risk accepted: in-context g2pW behavior on *novel* sentences is unverified until the zh epic runs the real image — that epic must include a real-model acceptance pass.
4. **Schema-evolution discipline under agent velocity.** Agents will be tempted to widen shared schemas ("just add an optional `toneTrack` field") because it's the locally shortest edit. Mitigations are the CI gates themselves (§2.4, oasdiff, regenerate-diff, zod→JSON-Schema freshness, TCK-on-every-PR) plus a standing reviewer instruction in the epic: *any* diff to `src/packages/contract` in a feature PR is a finding unless the PR is explicitly a contract-version PR. The union-of-all-languages schema is the named rot pattern every research angle independently flagged; the envelope + module-owned generated schema is the only sanctioned extension point.
5. **The mastery-graph abstraction could still be wrong for language 3.** It generalizes the dimensions we have two data points for: unit kinds × fade dimensions × gating edges × per-(dim × unit) directives × index-selector evidence propagation. Both committed languages now fit without private carve-outs — Arabic's root-prior propagation and Chinese's per-character gating are first-class, not exceptions — but a language whose coupling isn't expressible as unit-gates-dimension plus index selectors would force a contract major. Accepted: two points don't justify more generality (Section 6's own rule), and the declared-graph shape degrades gracefully — the declaration can grow additively.

---

*References: research angles `ts-di-composition`, `plugin-architectures`, `nlp-precedents`, `contract-testing-tck`, `polyglot-sidecar-contract`, `monorepo-layout` (2026-06 findings, cited inline); `docs/decisions/hosting-walking-skeleton.md`; `docs/decisions/design-system-inheritance.md`; committed Arabic + Chinese instance specs (`docs/plans/vocabulary-system.md`, `docs/plans/chinese-instance-design.md` — the nine-seam delta inventory); epic #3, children #5–#11 + the two new children of §5.3.*

---

## Amendment — dual-instance walking skeleton: simultaneous Arabic + Chinese (2026-07-02)

**Status:** accepted (operator directive, 2026-07). **Amends:** `docs/decisions/language-module-architecture.md` (§3.6, §4.2, §4.3, §5.2, §5.3, §7) and `docs/decisions/hosting-walking-skeleton.md` (new dual-instance topology section). **Supersedes:** every "build ar, then zh" sequencing statement in either ADR and in epic #3. No third ADR — the two existing ADRs each own half of this decision (contract/CI matrix; hosting topology); this text is split into their amendment sections, and `decisions-log.md` records the operator decision once.

### Context

The walking skeleton ships BOTH language instances riding the same contract, because the drop-in standard is only *enforced* if two real languages exercise it from the start. zh is the contract's designed stress case — segmentation inside the gate, two pinyin layers, ruby/LTR rendering — and building it as a simultaneous second consumer is what keeps the shared OpenAPI and the nine ports from cementing Arabic's accidents (ADR §3.2: "zh conforms" must never mean "zh imitates ar"). The enabling constraint is Decision 1: a zh v0 that holds never-show-wrong absolutely without deploying the unmeasured neural sidecar on faith.

### Decision 1 — zh sidecar v0 is deterministic-legs-only; the full gate runs at curation

The deployed zh sidecar v0 runs only deterministic legs: closed-world exact-cover segmentation over the sliver lexicon (no cover / out-of-world token → RED; **>1 valid cover → regenerate**), CC-CEDICT(Traditional)+Unihan citation-membership re-check (the only path to RED, per design §6.1), the §6.8 head-set lookup, the rule-based sandhi/不-一/neutral-tone resolver, the jieba voter normalized to the pinned AS standard (disagreement → YELLOW; → regenerate if intersecting a sandhi span), the 兩/二 numeral rule, and the intent cross-check. g2pW, AS-configured HanLP, and the refutation jury run **at curation time only**, offline, over the seed sliver — torch never ships in the v0 image (an appearance is a regression by construction).

**Heteronym policy (normative wording — use verbatim in child N2):** no surface form carries two sliver `reading_id`s; every non-sliver alternate CC-CEDICT reading of a sliver word is confirmed closed-world-unreachable at curation (machine-checked injectivity + reviewed unreachability); head-set singles admitted per C3/C9. Heteronyms are NOT "excluded from the seed" — exclusion is impossible (的/了/不/一 sit on the never-anglicize allowlist, §4.4) and would gut the beginner core (喝/好/看 all carry alternate CC-CEDICT readings).

**The head-set leg is context-keyed and fail-closed, not a bare char→reading table.** Inside the closed world, role-ambiguous head-set constructions are reachable: the §4.4-allowlisted potential infix composes V+不+了 (吃不了 — 了 reads liǎo, not the pinned le), and ordinal/date 一 (星期一, 一月) must stay unshifted yī. Therefore: (a) curation constraint **C9** — enumerate every head-set single's reachable local contexts (all in-world neighbor bigrams/trigrams, bounded by ~100 words × head set) and verify the pinned reading + resolver rule per context, jury/native-assisted; (b) the sidecar leg is `(char, role-context) → reading` with a **fail-closed default** — any context outside the verified enumeration → regenerate/RED; (c) two hard-coded fail-closed patterns regardless: 不/得 immediately followed by 了 after a verb → regenerate; 一 in ordinal/date positions resolved only by an enumerated rule, else regenerated. The honest form of the deferral argument is: hot g2pW is vacuous at v0 **because every reachable reading context is enumerated and verified at curation** — a checkable claim.

**Third-tone grouping is conservative-by-construction:** ALL 3+-syllable third-tone runs spanning more than one word → regenerate (within-word runs have curated, pre-verified groupings). No self-judging ambiguity detector sits on the display path. The design §8.8 snapshot fixture is exercised via a within-word / curation-pinned fixture; CI replay responses are curated to avoid cross-word runs.

The never-show-wrong chain: every displayed zh byte is a pre-verified tuple rendered with pinned (context-verified) readings and deterministically derived surface forms, or English. No neural inference sits on any display path, and every deterministic table consulted hot was verified at curation over an enumerable domain.

This does not violate `chinese-instance-design.md` §10.2's do-not-prune markers: v0 does not prune torch out of the neural sidecar — it defers the neural legs entirely, and the marker's own obligation (re-measure before provisioning) is honored by provisioning no neural image until N4's measurement spike.

### Decision 2 — Epic #3 ships both instances

Scope-in adds: the zh verification sidecar v0 (deterministic legs); the zh seed sliver (~30–100 TOCFL-spine Traditional words, every tuple pre-verified offline through the FULL gate at curation, heteronym policy per Decision 1); `@la/lang-zh` v0 (nine ports + ruby/LTR renderer registry entry + zh golden corpus + recorded zh replay responses); the zh CI matrix leg; dual deployment per Decision 4. Scope-out replaces "the Chinese instance is a later consumer" with named deferrals: neural legs hot + re-measure (child N4, explicitly NOT blocking epic Done — the epic body states this so no reviewer or engine run treats it as an unclosed child); jury hot; ingestion; mastery/fades (both languages stay FixedRatioScaffold); IME/GEC; TTS; breakdown-data build; native-checker *ongoing* calibration ops (the one-time gold pass is IN scope, in N2, budgeted — see the cost section of the epic). Done statement: a learner types an English message at EACH deployed URL (`lexercon.com` ar; `zh.lexercon.com` zh) and reads one coherent blended reply that hits the fixed ratio, contains zero unverified target-language bytes, streams with acceptable TTFT, renders per DESIGN.md (RTL/Amiri/ḥarakāt; LTR/ruby-pinyin/Noto Serif TC); AND the CI drop-in matrix is green on fake+ar+zh. Critical path: #6→#16→#7-spec→{#7 ∥ N1}→{#8 ∥ N2}→#9→#10→N3→#11.

### Decision 3 — CI matrix `[fake, ar, zh]`; lang-fake RETAINED with a narrowed role

ADR §4.3's matrix line becomes `matrix.lang = [fake, ar, zh]` (all three from the walking skeleton). The zh leg runs the real deterministic-legs v0 image directly, like the ar leg — no `SIDECAR_MODEL_MODE=fixture` needed until the neural legs land (fixture mode is dormant for zh v0; it activates with N4). The stale "pre-zh honesty" justification for lang-fake is struck; the fake re-earns its keep on three grounds no real leg covers at skeleton scope: (1) seams 4/5 law coverage — both real packs bind FixedRatioScaffold + the seam-5 bypass, so mastery-graph and curriculum TCK categories run against the fake alone until Phase 3; (2) deterministic failure topology — YELLOW/RED on demand, varied per-unit fade states neither real leg exercises under fixed directives; (3) the free canary — dependency-free, seconds-fast, first to break on contract change. Honest cost, stated in the ADR: every contract break now migrates fake+ar+zh in one PR (the matrix mechanizes it); the v0.x churn window compresses from an epoch to inside one epic — which is the point (churn is discovered while everything is v0). §4.2's zh probe row loses `spanGroup`: **離合詞 span-group probes activate with the zh separable-verb expansion child; spanGroup stays fake-covered until then** (C6 excludes 離合詞 from the sliver, so a real-leg spanGroup probe would be vacuous or red). §5.3's parenthetical ("the zh matrix leg… belong to the future zh epic") is struck: they are children of THIS epic (N1–N3); only the real-model acceptance pass moves to N4.

### Decision 5 — the real-g2pW drift tripwire is live from N2, not N4

Ownership resolved (previously contradictory): **N2 owns the curation-toolchain container** (which alone may run g2pW/HanLP; never deployed) **and enables the scheduled non-blocking CI drift job** against its own recorded curation baseline — real g2pW (torch in CI only) over the curation corpus + logged generated turns, diffed against pinned readings and the C9 context table. This keeps invariant I1 *continuously* honest from the skeleton onward, as the runtime resolution claims. N4 does NOT enable this job; it inherits the baseline as its acceptance floor. ADR §4.3's scheduled-jobs text says "enabled by N2"; N4's scope says "inherits N2's drift baseline."

### Deferred, with trigger (child N4)

g2pW hot; AS-HanLP on open text; g2pM/g2pC voters; fixture mode; hot jury (incl. cross-word 3-tone adjudication replacing the conservative regenerate); the CPU-torch measurement spike (MUST precede provisioning); pkuseg license; erhua/離合詞; OpenCC ingestion. Trigger: the first change opening the token universe beyond the exhaustively pre-verifiable closed set — sliver growth past exhaustive-curation capacity, the first second-`reading_id` surface form (the curation validator hard-fails on this, mechanizing the trigger), authentic ingestion, learner writing, any S→T byte. `GAPS.md` carries the row.

### Artifact reconciliation (one docs PR; then tracker edits)

This amendment, `decisions-log.md`, both ADRs, `INSTANCE.md` (one-liner + Status dual topology), `GAPS.md`, **and `README.md`** (line-3 one-liner and intro paragraph are Arabic-only public product claims — the AGENTS.md Update-Triggers "public-facing claims" row routes this change there) land in a single docs PR; the four child-issue creations and eight issue edits reference the merged amendment. `DESIGN.md`/`tokens.json` need no edit (the Locale `zh` mode already exists); N3's renderer PR reconciles only if a gap surfaces.