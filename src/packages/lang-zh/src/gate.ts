/**
 * `@la/lang-zh`'s seam-1 `VerificationGate` — the TEXT-IN/TOKENS-OUT gate
 * wired through `@la/contract`'s GENERATED sidecar client ONLY (never a
 * bespoke `fetch`/`axios` call — reviewer-gate AC, mirrors
 * `@la/lang-ar`'s `gate.ts`). Segmentation, banding, and the deterministic
 * v0 legs (closed-world exact-cover, CC-CEDICT/Unihan citation membership,
 * the C9 context-pinned head-set lookup, the sandhi/不-一 resolver, the
 * normalized jieba vote, the 兩/二 numeral rule) all happen INSIDE the real
 * `src/sidecars/zh` FastAPI service (dual-instance amendment Decision 1 —
 * deterministic-legs-only v0; g2pW/AS-HanLP/the jury run at curation time
 * only, never in this deployed image); this module only ENRICHES the
 * wire's flat pinyin-array payload into this pack's richer canonical
 * `ZhAnnotations` shape (per-character ruby units, the tone sub-track,
 * neutral-tone slots — see `annotations.ts`'s header for the full mapping
 * rationale) and maps it onto the contract's `VerifiedToken<ZhAnnotations>`.
 */

import { createSidecarClient } from "@la/contract/sidecar-client";
import type { Band, LegEvidence, PackContext, VerificationGate, VerifiedToken } from "@la/contract";
import { ZhAnnotationsSchema, type ZhAnnotations, type ZhCharacterUnit } from "./annotations.js";
import { toneOfDisplaySyllable } from "./pinyin-tone.js";

/** The real zh sidecar's thin per-token wire payload shape
 * (`src/sidecars/zh/app/gate.py::VerifyGate._payload`) — deliberately
 * loose/partial here since every field's presence depends on the token's
 * `kind` and `band`. */
interface ZhWirePayload {
  readingId?: string;
  citationPinyin?: string[];
  surfacePinyin?: string[];
  pos?: string;
  senseId?: string;
  gloss?: string;
  contextKey?: string;
  rule?: string;
  /** Present on a token-level RED (`gate.py`'s per-unit RED branch). */
  reason?: string;
  /** Present only on the whole-response candidate-level regenerate
   * collapse (`kind: "candidate"`, `gate.py::_regenerate_response`). */
  action?: string;
}

const EMPTY_LINGUISTIC_FIELDS = {
  perCharacter: [] as ZhCharacterUnit[],
  citationPinyin: [] as string[],
  surfacePinyin: [] as string[],
  toneTrack: [] as number[],
  neutralToneSlots: [] as number[],
  erhuaSlots: [] as number[],
  boundMorpheme: false,
};

/**
 * Enrich the real sidecar's thin wire payload into this pack's canonical
 * `ZhAnnotations` shape. Pure; total over every wire shape the real
 * `/v1/verify` response can emit (word/single/punct/digit GREEN/YELLOW,
 * any-kind RED, and the whole-response candidate-level regenerate
 * collapse).
 */
export function enrichZhAnnotations(
  spine: { surface: string; band: Band },
  wire: unknown,
): ZhAnnotations {
  const payload = (wire ?? {}) as ZhWirePayload;

  if (spine.band === "RED") {
    const redReason =
      payload.reason !== undefined
        ? payload.action !== undefined
          ? `${payload.action}:${payload.reason}`
          : payload.reason
        : undefined;
    return {
      ...EMPTY_LINGUISTIC_FIELDS,
      ...(redReason !== undefined ? { redReason } : {}),
    };
  }

  const citation = payload.citationPinyin ?? [];
  const surface = payload.surfacePinyin ?? [];
  if (citation.length === 0 && surface.length === 0) {
    // Non-linguistic token (punct/digit) — the wire payload is `{}`.
    return { ...EMPTY_LINGUISTIC_FIELDS };
  }

  const characters = [...spine.surface];
  const perCharacter: ZhCharacterUnit[] = characters.map((char, i) => ({
    char,
    citationPinyinChar: citation[i] ?? char,
    compositionalBoundFlag: false,
  }));
  const toneTrack = surface.map((syllable) => toneOfDisplaySyllable(syllable));
  const neutralToneSlots = toneTrack.flatMap((tone, i) => (tone === 5 ? [i] : []));

  return {
    ...(payload.readingId !== undefined ? { readingId: payload.readingId } : {}),
    perCharacter,
    citationPinyin: citation,
    surfacePinyin: surface,
    toneTrack,
    neutralToneSlots,
    erhuaSlots: [],
    ...(payload.pos !== undefined ? { pos: payload.pos } : {}),
    ...(payload.senseId !== undefined ? { senseId: payload.senseId } : {}),
    ...(payload.gloss !== undefined ? { gloss: payload.gloss } : {}),
    ...(payload.contextKey !== undefined ? { contextKey: payload.contextKey } : {}),
    ...(payload.rule !== undefined ? { rule: payload.rule } : {}),
    boundMorpheme: false,
  };
}

export function makeZhGate(ctx: PackContext): VerificationGate<ZhAnnotations> {
  // One generated client per gate instance, bound to the pack's configured
  // sidecar base URL — mirrors `makeArGate`.
  const client = createSidecarClient(ctx.sidecar.baseUrl);

  return {
    async verify(candidate, _turnCtx) {
      const result = await client.http.POST("/v1/verify", {
        body: { targetText: candidate.targetText, intents: candidate.intents },
      });
      if (result.error !== undefined || result.data === undefined) {
        throw new Error(
          `zh gate: POST /v1/verify failed (status ${result.response.status}): ` +
            `${result.error !== undefined ? JSON.stringify(result.error) : "no response body"}`,
        );
      }

      return result.data.tokens.map((token): VerifiedToken<ZhAnnotations> => {
        const enriched = enrichZhAnnotations(
          { surface: token.spine.surface, band: token.band },
          token.annotations.payload,
        );
        const payload = ZhAnnotationsSchema.parse(enriched);
        const evidence: LegEvidence[] = token.evidence.map((leg) => ({
          legId: leg.legId,
          pass: leg.pass,
          ...(leg.detail !== undefined ? { detail: leg.detail } : {}),
        }));
        return {
          spine: {
            id: token.spine.id,
            // Hardcoded, not `token.spine.lang` — the wire field is
            // opaque-string per the shared spec; this pack statically
            // knows its own language (mirrors `@la/lang-ar`'s gate).
            lang: "zh",
            surface: token.spine.surface,
            kind: token.spine.kind,
            status: token.spine.status,
            band: token.band,
            ...(token.spine.spanGroup !== undefined ? { spanGroup: token.spine.spanGroup } : {}),
          },
          band: token.band,
          evidence,
          annotations: payload,
        };
      });
    },
  };
}
