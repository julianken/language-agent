/**
 * `@la/lang-ar`'s seam-3 `AnnotationCodec` — the encode/decode HALVES issue
 * #9 owns (`annotations.ts`'s header: "the pack's TS `AnnotationCodec`
 * encode/decode halves are explicitly #9's pack wiring, NOT this module").
 * The zod `schema` itself is #7's, imported verbatim.
 */

import type { AnnotationCodec } from "@la/contract";
import { AR_ANNOTATIONS_SCHEMA_ID, ArAnnotationsSchema, type ArAnnotations } from "./annotations.js";

export const arAnnotationCodec: AnnotationCodec<ArAnnotations> = {
  schema: ArAnnotationsSchema,
  schemaId: AR_ANNOTATIONS_SCHEMA_ID,
  /** Must round-trip through JSON (TCK law) — a plain deep-clone via JSON
   * suffices since `ArAnnotations` is already JSON-shaped. */
  encode: (ann) => JSON.parse(JSON.stringify(ann)) as unknown,
  decode: (raw) => ArAnnotationsSchema.parse(raw),
};
