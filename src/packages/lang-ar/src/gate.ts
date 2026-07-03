/**
 * `@la/lang-ar`'s seam-1 `VerificationGate` (issue #9's pack wiring) — the
 * TEXT-IN/TOKENS-OUT gate wired through `@la/contract`'s GENERATED sidecar
 * client ONLY (never a bespoke `fetch`/`axios` call — reviewer-gate AC).
 * Segmentation, banding, and annotation minting all happen INSIDE the real
 * `src/sidecars/ar` FastAPI service (`dediac-roundtrip` + `camel-morph`
 * legs, `docs/research/arabic-validation.md` §6); this module only maps the
 * wire response onto the contract's `VerifiedToken<ArAnnotations>` shape.
 */

import { createSidecarClient } from "@la/contract/sidecar-client";
import type { LegEvidence, PackContext, VerificationGate, VerifiedToken } from "@la/contract";
import { ArAnnotationsSchema, type ArAnnotations } from "./annotations.js";

export function makeArGate(ctx: PackContext): VerificationGate<ArAnnotations> {
  // One generated client per gate instance, bound to the pack's configured
  // sidecar base URL — memoized, mirroring `@la/lang-fake`'s memoized asset
  // read (`makeFakeGate`).
  const client = createSidecarClient(ctx.sidecar.baseUrl);

  return {
    async verify(candidate, _turnCtx) {
      const result = await client.http.POST("/v1/verify", {
        body: { targetText: candidate.targetText, intents: candidate.intents },
      });
      if (result.error !== undefined || result.data === undefined) {
        throw new Error(
          `ar gate: POST /v1/verify failed (status ${result.response.status}): ` +
            `${result.error !== undefined ? JSON.stringify(result.error) : "no response body"}`,
        );
      }

      return result.data.tokens.map((token): VerifiedToken<ArAnnotations> => {
        const payload = ArAnnotationsSchema.parse(token.annotations.payload as unknown);
        const evidence: LegEvidence[] = token.evidence.map((leg) => ({
          legId: leg.legId,
          pass: leg.pass,
          ...(leg.detail !== undefined ? { detail: leg.detail } : {}),
        }));
        return {
          spine: {
            id: token.spine.id,
            // Hardcoded, not `token.spine.lang` — the wire field is
            // opaque-string per the shared spec; this pack statically knows
            // its own language (same pattern as `@la/lang-fake`'s gate).
            lang: "ar",
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
