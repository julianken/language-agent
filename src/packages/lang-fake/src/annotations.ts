/**
 * The fake pack's annotation payload (seam 3) — the per-language shape
 * behind the shared spine. The zod schema is the canonical source
 * (ADR §1.3 seam 3); the JSON-Schema generation pipeline lands with #7.
 */

import { z } from "zod";
import type { AnnotationCodec } from "@la/contract";

export const FakeAnnSchema = z.object({
  /** The learnable lexeme this token maps to (span-grouped tokens share
   * their compound's lexeme, e.g. both halves of `mip … tok` carry
   * `miptok`). */
  lexemeId: z.string().min(1),
  gloss: z.string(),
  /** Per-glyph scaffold hints — the fake's analog of per-character
   * segmental pinyin (what the `glyphHint` fade dimension shows/hides
   * PER GLYPH UNIT within one token). */
  glyphs: z.array(z.object({ glyph: z.string().min(1), hint: z.string() })),
});

export type FakeAnn = z.infer<typeof FakeAnnSchema>;

export const fakeAnnotationCodec: AnnotationCodec<FakeAnn> = {
  schema: FakeAnnSchema,
  schemaId: "fake-annotations/v1",
  encode: (ann) => JSON.parse(JSON.stringify(ann)) as unknown,
  decode: (raw) => FakeAnnSchema.parse(raw),
};

/** Deterministic glyph decomposition: every non-space character of the
 * surface is one glyph unit; its hint is the uppercased glyph (the fake's
 * "ruby above the glyph"). */
export function glyphsOf(surface: string): FakeAnn["glyphs"] {
  return [...surface.replaceAll(" ", "")].map((glyph) => ({
    glyph,
    hint: glyph.toUpperCase(),
  }));
}
