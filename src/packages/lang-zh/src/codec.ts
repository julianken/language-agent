/**
 * `@la/lang-zh`'s seam-3 `AnnotationCodec` — the encode/decode HALVES,
 * mirroring `@la/lang-ar`'s `codec.ts` exactly. The zod `schema` is this
 * pack's own (`annotations.ts`), not inherited from `@la/contract`.
 */

import type { AnnotationCodec } from "@la/contract";
import { ZH_ANNOTATIONS_SCHEMA_ID, ZhAnnotationsSchema, type ZhAnnotations } from "./annotations.js";

export const zhAnnotationCodec: AnnotationCodec<ZhAnnotations> = {
  schema: ZhAnnotationsSchema,
  schemaId: ZH_ANNOTATIONS_SCHEMA_ID,
  /** Must round-trip through JSON (TCK law) — a plain deep-clone via JSON
   * suffices since `ZhAnnotations` is already JSON-shaped. */
  encode: (ann) => JSON.parse(JSON.stringify(ann)) as unknown,
  decode: (raw) => ZhAnnotationsSchema.parse(raw),
};
