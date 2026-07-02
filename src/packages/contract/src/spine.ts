/**
 * The shared token spine — the language-agnostic half of every token.
 *
 * The spine is contract-owned and CLOSED (ADR §1.3 seam 3): its field set
 * never grows a per-language member. Everything language-specific rides the
 * opaque `annotations: TAnn` payload on `VerifiedToken` (Rollup-`meta`
 * convention) — Chinese tone tracks never appear as optional fields on
 * Arabic tokens.
 */

/**
 * The closed set of in-tree language ids (ADR §2.2, §2.3). Adding language N
 * widens this union — a deliberate contract-version edit, paired with the
 * one compiler-checked registry line in the composition root (ADR §2.3).
 */
export type LanguageId = "fake" | "ar" | "zh";

/** Opaque per-token id, unique within one verified stream. */
export type TokenId = string;

/**
 * Groups NON-ADJACENT tokens into one learnable unit (ADR §1.3 port 1):
 * e.g. zh 離合詞 separable verbs are minted as discontinuous spans at
 * segmentation time. Tokens sharing a `SpanGroupId` map onto the same
 * learnable unit even though other tokens sit between them.
 */
export type SpanGroupId = string;

/**
 * Pack-declared token-kind vocabulary (opaque to the engine). The renderer
 * registry keys on it (`RendererManifest.tokenRenderers`); the engine never
 * branches on a kind value.
 */
export type TokenKind = string;

/**
 * The learner-status slot on the spine (the "mastered/fading/new"-shaped
 * axis the renderer stories exercise, ADR §4.2 seam 6). Values are
 * pack-interpreted, engine-opaque — same discipline as `TokenKind`.
 * v0-minimal: gates mint a pack-chosen initial status; the engine stamps
 * mastery-derived statuses when real mastery wiring lands (post-skeleton).
 */
export type TokenStatus = string;

/** Verification band. GREEN = verified; YELLOW = degraded confidence (e.g.
 * segmenter-vote disagreement); RED = refused (never displayed on a
 * GENERATED stream — ADR §1.5's scoped RED law). */
export type Band = "GREEN" | "YELLOW" | "RED";

/**
 * Evidence from one verification leg. `legId` is an OPAQUE string the
 * engine logs but never branches on (ADR §1.3 port 1 — capability
 * declaration, not negotiation).
 */
export interface LegEvidence {
  legId: string;
  pass: boolean;
  detail?: string;
}

/**
 * The shared token spine (ADR §1.3 seam 3): `id, lang, kind, status, band,
 * spanGroup?` — the only fields shared client code touches (ADR §1.5 SSE
 * schema). CLOSED: no per-language field is ever added here.
 */
export interface TokenSpine {
  id: TokenId;
  lang: LanguageId;
  /** The verified surface text of this token. */
  surface: string;
  kind: TokenKind;
  status: TokenStatus;
  /** Mirrors `VerifiedToken.band` — the gate mints the spine already banded
   * (token boundaries and bands are both OUTPUTS of verification). */
  band: Band;
  /** Present only when this token is part of a discontinuous learnable
   * unit (ADR §1.3 port 1). */
  spanGroup?: SpanGroupId;
}

/**
 * The gate's output element (ADR §1.3 port 1):
 * `{ spine, band, evidence, annotations }`. `band` restates `spine.band`
 * at top level per the port-1 contract sketch; the two always agree.
 */
export interface VerifiedToken<TAnn = unknown> {
  spine: TokenSpine;
  band: Band;
  evidence: LegEvidence[];
  /** The per-language payload behind the shared spine — opaque generic,
   * validated against the pack codec's canonical zod schema at wire and
   * storage boundaries (ADR §1.3 seam 3). */
  annotations: TAnn;
}
