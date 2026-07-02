/**
 * Spine schemas for the fake pack's two named assets (seam 9). The gate
 * reads BOTH through the scoped `PackContext.assets` reader — the fake's
 * closed world lives in the assets, not in code, so the PackContext seam
 * is exercised for real from the first boot.
 */

import { z } from "zod";

export const LexiconRowSchema = z.object({
  lexemeId: z.string().min(1),
  surface: z.string().min(1),
  gloss: z.string(),
  /** Deterministic YELLOW marker: the fake's "segmenter jury" always
   * disagrees on this lexeme's boundaries. */
  yellow: z.boolean().optional(),
});
export const LexiconSchema = z.array(LexiconRowSchema);
export type LexiconRow = z.infer<typeof LexiconRowSchema>;

export const SegmentationTableSchema = z.object({
  /** Consecutive whitespace chunks that are ONE token (naive split is
   * wrong by under-segmentation): `wug bo` → one `wugbo` token. */
  merges: z.array(
    z.object({ parts: z.array(z.string().min(1)).min(2), lexemeId: z.string().min(1) }),
  ),
  /** Single whitespace chunks that are SEVERAL tokens (naive split is
   * wrong by over-segmentation): `frobnub` → `frob` + `nub`. */
  splits: z.array(
    z.object({ chunk: z.string().min(1), into: z.array(z.string().min(1)).min(2) }),
  ),
  /** Discontinuous separable pairs (the fake's 離合詞): first…second
   * co-occurring map onto ONE learnable unit via a shared spanGroup. */
  spanPairs: z.array(
    z.object({
      first: z.string().min(1),
      second: z.string().min(1),
      lexemeId: z.string().min(1),
    }),
  ),
});
export type SegmentationTable = z.infer<typeof SegmentationTableSchema>;
