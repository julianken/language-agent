// @la/lang-ar — the Arabic language pack.
//
// v0 content (issue #7's spec-first opening PR): the canonical annotation
// zod schema — the `schema` half of seam 3 ONLY (see ./annotations.ts for
// the ownership note; encode/decode are #9's pack wiring). The full Arabic
// LanguagePack implementing the nine contract ports, plus the `/react` and
// `/assets` subpath exports, is owned by issue #7's later implementation
// PRs and successors (#8 seed vocab, #10 renderer).
export {
  AR_ANNOTATIONS_SCHEMA_ID,
  ArAnnotationsSchema,
  ArMorphologySchema,
  ArVowelStateSchema,
} from "./annotations.js";
export type {
  ArAnnotations,
  ArMorphology,
  ArVowelState,
} from "./annotations.js";
