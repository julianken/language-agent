/**
 * The fake verification gate (seam 1) — TEXT-IN, TOKENS-OUT, and
 * deliberately RE-SEGMENTING (ADR §4.3): token boundaries are an OUTPUT of
 * verification and differ from a naive whitespace split in both
 * directions (merge: `wug bo` → one token; split: `frobnub` → two), plus
 * discontinuous span-group minting (`mip … tok`) — the topology zh will
 * actually exercise, none of which an ar-shaped fake would prove.
 *
 * Fully deterministic, dependency-free, in-process. Two opaque legs:
 * `lexicon-membership` (fails → RED — the only path to RED) and
 * `boundary-vote` (fails → YELLOW, deterministically on `yellow`-flagged
 * lexemes). Intents are accepted per the port signature; the fake performs
 * no intent cross-check (a real pack's gate does — e.g. zh's intent
 * cross-check leg).
 */

import type {
  LegEvidence,
  PackContext,
  VerificationGate,
  VerifiedToken,
} from "@la/contract";
import { glyphsOf, type FakeAnn } from "./annotations.js";
import {
  LexiconSchema,
  SegmentationTableSchema,
  type LexiconRow,
  type SegmentationTable,
} from "./assets-schema.js";

interface ClosedWorld {
  byLexeme: Map<string, LexiconRow>;
  table: SegmentationTable;
}

async function loadClosedWorld(ctx: PackContext): Promise<ClosedWorld> {
  const lexicon = LexiconSchema.parse(await ctx.assets.read("lexicon"));
  const table = SegmentationTableSchema.parse(
    await ctx.assets.read("segmentation-table"),
  );
  return { byLexeme: new Map(lexicon.map((r) => [r.lexemeId, r])), table };
}

interface PendingToken {
  surface: string;
  lexemeId: string | undefined;
}

/** Deterministic re-segmentation: merge pass, then split pass, then
 * lexicon lookup for the rest. */
function segment(targetText: string, world: ClosedWorld): PendingToken[] {
  const chunks = targetText.trim().split(/\s+/u).filter((c) => c.length > 0);
  const out: PendingToken[] = [];
  let i = 0;
  outer: while (i < chunks.length) {
    for (const merge of world.table.merges) {
      const slice = chunks.slice(i, i + merge.parts.length);
      if (
        slice.length === merge.parts.length &&
        slice.every((c, j) => c === merge.parts[j])
      ) {
        out.push({ surface: slice.join(" "), lexemeId: merge.lexemeId });
        i += merge.parts.length;
        continue outer;
      }
    }
    const chunk = chunks[i] as string;
    const split = world.table.splits.find((s) => s.chunk === chunk);
    if (split) {
      for (const part of split.into) {
        out.push({
          surface: part,
          lexemeId: world.byLexeme.has(part) ? part : undefined,
        });
      }
      i += 1;
      continue;
    }
    out.push({
      surface: chunk,
      lexemeId: world.byLexeme.has(chunk) ? chunk : undefined,
    });
    i += 1;
  }
  return out;
}

export function makeFakeGate(ctx: PackContext): VerificationGate<FakeAnn> {
  // Memoized: assets are read once per gate instance, through the scoped
  // reader (already spine-schema-validated at boot; re-parsed here so the
  // gate is safe standalone too).
  let worldPromise: Promise<ClosedWorld> | undefined;
  const world = () => (worldPromise ??= loadClosedWorld(ctx));

  return {
    async verify(candidate, _turnCtx) {
      const w = await world();
      const pending = segment(candidate.targetText, w);

      // Span pass: first `first` lexeme + first LATER `second` lexeme share
      // a span group and remap onto the compound learnable unit.
      const spanGroups = new Map<number, { group: string; lexemeId: string }>();
      w.table.spanPairs.forEach((pair, p) => {
        const a = pending.findIndex((t) => t.lexemeId === pair.first);
        if (a < 0) return;
        const b = pending.findIndex(
          (t, j) => j > a && t.lexemeId === pair.second,
        );
        if (b < 0) return;
        const group = `sg:${pair.lexemeId}:${p}`;
        spanGroups.set(a, { group, lexemeId: pair.lexemeId });
        spanGroups.set(b, { group, lexemeId: pair.lexemeId });
      });

      return pending.map((t, i): VerifiedToken<FakeAnn> => {
        const span = spanGroups.get(i);
        const lexemeId = span?.lexemeId ?? t.lexemeId;
        const row = lexemeId ? w.byLexeme.get(lexemeId) : undefined;
        const membership: LegEvidence = {
          legId: "lexicon-membership",
          pass: row !== undefined,
          detail: row ? `lexeme ${row.lexemeId}` : `out of closed world: ${t.surface}`,
        };
        const boundary: LegEvidence = {
          legId: "boundary-vote",
          pass: row !== undefined && row.yellow !== true,
          detail:
            row?.yellow === true
              ? "segmenter jury deterministically disagrees"
              : "boundary vote unanimous",
        };
        const band = !membership.pass ? "RED" : !boundary.pass ? "YELLOW" : "GREEN";
        const annotations: FakeAnn = {
          lexemeId: lexemeId ?? `unknown:${t.surface}`,
          gloss: row?.gloss ?? "",
          glyphs: glyphsOf(t.surface),
        };
        return {
          spine: {
            id: `t${i}`,
            lang: "fake",
            surface: t.surface,
            kind: "word",
            status: "new",
            band,
            ...(span ? { spanGroup: span.group } : {}),
          },
          band,
          evidence: [membership, boundary],
          annotations,
        };
      });
    },
  };
}
