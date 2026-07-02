/**
 * The remaining port types (seams 1, 2, 3, 5, 6, 7, 8 — ADR §1.3).
 * Seam 4 (mastery) lives in `mastery.ts`; seam 9 (assets) in `assets.ts`.
 */

import type { z } from "zod";
import type { Band, TokenSpine, VerifiedToken } from "./spine.js";
import type { FadeDimId, ScaffoldDirective, UnitRef } from "./scaffold.js";
import type { PackContext } from "./pack-context.js";

// ---------------------------------------------------------------------------
// Seam 1 — VerificationGate: the trust spine, TEXT-IN / TOKENS-OUT.
// ---------------------------------------------------------------------------

/**
 * One communicative intent of the turn. v0-minimal (widens with #9's turn
 * loop inside the v0.x churn window); the gate cross-checks the candidate
 * text against these.
 */
export interface TurnIntent {
  id: string;
  description: string;
}

/** Per-turn context handed to `verify`. v0-minimal (widens with #9). */
export interface TurnContext {
  turnId: string;
}

/**
 * Seam 1 (ADR §1.3 port 1) — TEXT-IN, TOKENS-OUT. The gate receives the
 * candidate target TEXT plus the turn's intents and returns the banded
 * token stream: token boundaries are an OUTPUT of verification, not an
 * input. Spec-mandated zh-true shape: the Chinese gate performs
 * segmentation INSIDE the gate (the multi-segmenter boundary vote can
 * downgrade a band; 離合詞 separable verbs are minted as discontinuous
 * `spanGroup`s at segmentation time). Arabic, whose LLM emits
 * pre-tokenized output, trivially maps its tokens through. Leg composition
 * lives entirely inside the pack.
 */
export interface VerificationGate<TAnn = unknown> {
  verify(
    candidate: { targetText: string; intents: TurnIntent[] },
    ctx: TurnContext,
  ): Promise<VerifiedToken<TAnn>[]>;
}

export type VerificationGateFactory<TAnn = unknown> = (
  ctx: PackContext,
) => VerificationGate<TAnn>;

// ---------------------------------------------------------------------------
// Seam 2 — SteeringPolicy: generation constraints + anglicize-down.
// ---------------------------------------------------------------------------

/** The turn's generation plan. v0-minimal (widens with #9). */
export interface TurnPlan {
  intents: TurnIntent[];
}

/** Prompt-assembly hints for the LLM generation step. v0-minimal. */
export interface PromptConstraints {
  instructions: string[];
}

/** One generated candidate text (pre-gate). */
export interface CandidateText {
  text: string;
}

/**
 * Snapshot of the learner the scheduler/steering read. v0-minimal — the
 * walking skeleton binds FixedRatioScaffold and bypasses the cascade
 * (ADR §5.2 #9); this widens when real mastery/curriculum wiring lands.
 */
export interface UserSnapshot {
  userId: string;
}

/** One segment of an anglicized (blended) stream. */
export type BlendedSegment<TAnn = unknown> =
  | { kind: "target"; token: VerifiedToken<TAnn> }
  | { kind: "english"; text: string; replaced: UnitRef[] };

/**
 * Output of `anglicizeDown`. Deliberately a DIFFERENT type from
 * `VerifiedToken[]` (ADR §4.2): the type asymmetry is what keeps
 * "TTS from unverified text" unrepresentable — `TtsDriver.synthesize`
 * accepts only `VerifiedToken[]`.
 */
export interface BlendedStream<TAnn = unknown> {
  segments: BlendedSegment<TAnn>[];
}

/**
 * Seam 2 (ADR §1.3 port 2). Clitic rules vs separable-verb/system-morpheme
 * allowlists are ALGORITHMS inside the pack, not config data.
 *
 * `anglicizeDown` is PURE (deterministic on same inputs). Its TCK laws
 * (ADR §4.2): (a) subtraction-safety — the output's target-language token
 * multiset is a subset of the input's (no target byte minted);
 * (b) allowlist inviolability under ANY mastery snapshot; (c) frame
 * preservation — non-anglicized tokens keep order and content.
 * `directives[i]` corresponds to `stream[i]`; a missing directive means
 * "leave the token in the target language".
 */
export interface SteeringPolicy<TAnn = unknown> {
  generationConstraints(plan: TurnPlan): PromptConstraints;
  /** Optional pack hook for pack-semantic ranking terms (zh register
   * fit); deterministic; defaults to 0 when absent. */
  scoreCandidate?(candidate: CandidateText, snapshot: UserSnapshot): number;
  anglicizeDown(
    stream: VerifiedToken<TAnn>[],
    directives: ScaffoldDirective[],
  ): BlendedStream<TAnn>;
}

export type SteeringPolicyFactory<TAnn = unknown> = (
  ctx: PackContext,
) => SteeringPolicy<TAnn>;

// ---------------------------------------------------------------------------
// Seam 3 — AnnotationCodec: the per-language payload behind the spine.
// ---------------------------------------------------------------------------

/**
 * Seam 3 (ADR §1.3 port 3). The zod `schema` is the SINGLE canonical
 * source: the pack build GENERATES its JSON Schema artifact from it (the
 * generation pipeline + freshness gate land with #7's spec-first PR).
 * Cached annotation payloads are RE-DERIVABLE: a `schemaId` bump
 * invalidates caches — contrast learner state, which must MIGRATE
 * (ADR §1.4, §3.5).
 */
export interface AnnotationCodec<TAnn = unknown> {
  /** Canonical; validated at wire/storage boundaries (generics erase). */
  schema: z.ZodType<TAnn>;
  /** e.g. `ar-annotations/v1`. */
  schemaId: string;
  /** Must round-trip through JSON: `decode(encode(a))` deep-equals `a`. */
  encode(ann: TAnn): unknown;
  decode(raw: unknown): TAnn;
}

// ---------------------------------------------------------------------------
// Seam 5 — CurriculumPolicy: per-turn selection inputs.
// ---------------------------------------------------------------------------

/** Topic of the current conversation turn. v0-minimal. */
export type Topic = string;

/** One pack-supplied selection candidate. v0-minimal (widens with the
 * real cascade wiring — the skeleton bypasses seam 5, ADR §5.2 #9). */
export interface Candidate {
  unit: UnitRef;
}

/**
 * A pack-declared coverage floor the engine evaluates GENERICALLY
 * (zh's dual floor = two entries in `floors`). `candidateStream` is the
 * FULL candidate token stream — the specs' floors are over the generated
 * running text, not over the chosen new words (ADR §1.3 port 5).
 */
export interface CoverageFloor {
  id: string;
  satisfied(candidateStream: TokenSpine[], snapshot: UserSnapshot): boolean;
}

/**
 * Seam 5 (ADR §1.3 port 5). The engine owns the shared cascade
 * (FSRS-due → topic-relevant in-band → curriculum-rank fallback) and the
 * novelty budget; the pack supplies candidates and floor predicates.
 */
export interface CurriculumPolicy {
  candidates(snapshot: UserSnapshot, topic: Topic): Candidate[];
  floors: CoverageFloor[];
}

/**
 * The seam-5 factory. Object-shaped like `MasteryModelFactory` because the
 * floor IDS feed `deriveCapabilities` pre-instantiation (ADR §2.2):
 * `floors` is the static half (floor predicates are pure over explicit
 * args and need no context); `make` closes over the narrow context (e.g.
 * the scoped asset reader) and returns the full policy, re-carrying the
 * SAME `floors` (spread them — one source).
 */
export interface CurriculumPolicyFactory {
  floors: CoverageFloor[];
  make(ctx: PackContext): CurriculumPolicy;
}

// ---------------------------------------------------------------------------
// Seam 6 — RendererManifest: keys into the client component registry.
// ---------------------------------------------------------------------------

/** A key into `apps/web`'s client-side component registry. Actual React
 * components export from `@la/lang-<x>/react`; the shared shell imports
 * ZERO language components (ADR §1.3 port 6). */
export type ComponentKey = string;

/**
 * Seam 6 (ADR §1.3 port 6). Structural deltas (inline diacritic fade vs
 * ruby-above-glyph) = swapped components; value deltas (fonts, direction,
 * spacing) = design tokens per Locale mode — the code mirror of the
 * design-system-inheritance ADR.
 */
export interface RendererManifest {
  direction: "rtl" | "ltr";
  tokenRenderers: Record<string, ComponentKey>;
  breakdownPanel: ComponentKey;
}

// ---------------------------------------------------------------------------
// Seam 7 — TtsDriver: synthesize ONLY from the gate-verified surface form.
// ---------------------------------------------------------------------------

/** Voice selection, mirroring the instance config's `tts` slice. */
export interface VoiceConfig {
  provider: string;
  voice: string;
}

/** Synthesized payload. v0-minimal: `format` names the pack-chosen payload
 * convention (e.g. SSML with phoneme overrides); `content` carries it. */
export interface TtsPayload {
  format: string;
  content: string;
}

/**
 * Seam 7 (ADR §1.3 port 7). The input type is `VerifiedToken[]`, making
 * "TTS from unverified text" UNREPRESENTABLE (shared ordering, TCK law).
 */
export interface TtsDriver {
  synthesize(
    verified: VerifiedToken[],
    voice: VoiceConfig,
  ): Promise<TtsPayload>;
}

export type TtsDriverFactory = (ctx: PackContext) => TtsDriver;

// ---------------------------------------------------------------------------
// Seam 8 — SidecarDescriptor.
// ---------------------------------------------------------------------------

/**
 * Seam 8 (ADR §1.3 port 8). Declares the container image ref, required
 * contract version, and expected capability legs. The engine provisions
 * and health-checks it; the pack only ever talks through the injected
 * typed client. The boot-time cross-check against the sidecar's live
 * `/v1/capabilities` (`assertSidecarAgrees`) lands with #7's spec-first
 * PR.
 */
export interface SidecarDescriptor {
  imageRef: string;
  contractVersion: string;
  /** Opaque leg ids expected from `/v1/capabilities`; the engine logs and
   * cross-checks them but never branches on them. */
  expectedLegs: string[];
}
