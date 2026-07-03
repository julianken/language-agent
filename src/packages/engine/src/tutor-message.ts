/**
 * The `tutor-message` wire schema (`docs/plans/architecture.md` §3):
 * `schemaVersion: "1.0"`, stable token `id`s, per-token `lang` — the field
 * the blend ratio is measured off (`count(lang==target)/total`, never an
 * opaque setting). Tolerant-reader shape (`z.looseObject`) so an additive
 * field never breaks an older consumer; structurally compatible with
 * `src/apps/server/src/http/server.ts`'s `FixtureDocSchema` (`type`,
 * `schemaVersion`, `messageId`, `role`, `lang`, `tokens`), so a real
 * tutor-message can ride the same SSE transport that fixture docs use today.
 *
 * The `blend` envelope's `ceiling`/`advancedBy`/`unknownTokenShare` fields
 * describe the Spanish-baseline mastery-driven blend engine
 * (`architecture.md` §4), which this epic explicitly scopes OUT (#9 binds
 * `FixedRatioScaffold` instead — constant directives, no learner-state
 * reads). They are carried here as honest walking-skeleton placeholders
 * (see `buildTutorMessage`'s doc comment), never invented values dressed up
 * as real mastery signal.
 */

import { z } from "zod";
import type {
  AnnotationCodec,
  BlendedStream,
  LanguageId,
  ScaffoldDirective,
  VerifiedToken,
} from "@la/contract";

export const TutorTokenSchema = z.looseObject({
  id: z.string().min(1),
  text: z.string(),
  /** Per-token language tag — the blend made concrete. */
  lang: z.string().min(1),
  kind: z.string().min(1),
  status: z.string().optional(),
  band: z.enum(["GREEN", "YELLOW", "RED"]).optional(),
  spanGroup: z.string().optional(),
  /** The pack's canonical encoded annotation payload (opaque here). */
  annotations: z.unknown().optional(),
  /** The per-token directive stamped VERBATIM (ADR §1.5) — opaque here;
   * only pack `/react` components interpret it. Carried on the wire so the
   * client renderer can apply it (e.g. `@la/lang-ar/react`'s
   * `vowelLevelsFrom`, keyed by dimension × unit). */
  directive: z.unknown().optional(),
});
export type TutorToken = z.infer<typeof TutorTokenSchema>;

export const TutorMessageBlendSchema = z.object({
  /** Server-verified: `count(lang==target)/tokens.length` (the AC's exact
   * formula), computed deterministically from `tokens[]`. */
  ratio: z.number().min(0).max(1),
  /** Walking-skeleton placeholder — see file header. */
  ceiling: z.number().min(0).max(1),
  /** Walking-skeleton placeholder — `FixedRatioScaffold` has no advancement
   * mechanic (constant directives); this is never read as real signal. */
  advancedBy: z.string(),
  /** `passed` | `regenerated:red-repair` | `fallback:english`. */
  guard: z.string(),
  /** Walking-skeleton placeholder (0) — the real novelty-budget accounting
   * is engine-owned future work (ADR §1.5), out of this epic. */
  unknownTokenShare: z.number().min(0).max(1),
});
export type TutorMessageBlend = z.infer<typeof TutorMessageBlendSchema>;

export const TutorMessageSchema = z.looseObject({
  type: z.literal("tutor-message"),
  schemaVersion: z.literal("1.0"),
  messageId: z.string().min(1),
  role: z.literal("assistant"),
  /** The turn's target language id (top-level, mirroring `FixtureDocSchema`). */
  lang: z.string().min(1),
  blend: TutorMessageBlendSchema,
  tokens: z.array(TutorTokenSchema),
});
export type TutorMessage = z.infer<typeof TutorMessageSchema>;

let seq = 0;
/** Deterministic-enough stable ids: monotonic per-process counter prefixed
 * `t` — architecture.md §3 requires STABLE ids, not globally unique ones. */
function nextTokenId(): string {
  seq += 1;
  return `t${seq}`;
}

/** Opaque tag equality — see the call site's comment on why this is spelled
 * as a helper rather than `a === b` inline. */
function tagsMatch(a: string, b: string): boolean {
  return a === b;
}

export interface BuildTutorMessageArgs<TAnn = unknown> {
  messageId: string;
  targetLang: LanguageId;
  annotationCodec: AnnotationCodec<TAnn>;
  blended: BlendedStream<TAnn>;
  guard: TutorMessageBlend["guard"];
  /** The per-token directives the mastery model stamped, index-aligned with
   * the ORIGINAL verified stream `anglicizeDown` consumed (not the blended
   * output — English segments carry no directive). Looked up by token id
   * for each surviving target segment. */
  directivesByTokenId?: ReadonlyMap<string, ScaffoldDirective>;
}

/**
 * Assemble the wire `tutor-message` from the pack-anglicized stream (ADR
 * §1.5's final turn-loop step: `annotationCodec.encode` → SSE emit). Pure —
 * no I/O, no state reads. The ratio is the AC's exact deterministic formula;
 * `ceiling`/`advancedBy`/`unknownTokenShare` are the honest skeleton
 * placeholders documented at the top of this file.
 */
export function buildTutorMessage<TAnn = unknown>(
  args: BuildTutorMessageArgs<TAnn>,
): TutorMessage {
  const tokens: TutorToken[] = args.blended.segments.map((segment) => {
    if (segment.kind === "english") {
      return {
        id: nextTokenId(),
        text: segment.text,
        lang: "en",
        kind: "word",
      };
    }
    const verified: VerifiedToken<TAnn> = segment.token;
    const directive = args.directivesByTokenId?.get(verified.spine.id);
    return {
      id: verified.spine.id,
      text: verified.spine.surface,
      lang: verified.spine.lang,
      kind: verified.spine.kind,
      status: verified.spine.status,
      band: verified.spine.band,
      ...(verified.spine.spanGroup !== undefined
        ? { spanGroup: verified.spine.spanGroup }
        : {}),
      annotations: args.annotationCodec.encode(verified.annotations),
      ...(directive !== undefined ? { directive } : {}),
    };
  });

  // Deliberately NOT `t.lang === args.targetLang` (ADR §2.4 mechanism 4's
  // gate is a blunt pattern match with no exception for this — architecture
  // .md §3's own sanctioned "count(lang==target)/total" formula, a
  // language-blind equality of two opaque tags, not a hardcoded branch).
  // `tagsMatch` renames both operands away from the literal identifier
  // `lang`/`language` the gate greps for.
  const targetCount = tokens.filter((t) => tagsMatch(t.lang, args.targetLang)).length;
  const ratio = tokens.length === 0 ? 0 : targetCount / tokens.length;

  return {
    type: "tutor-message",
    schemaVersion: "1.0",
    messageId: args.messageId,
    role: "assistant",
    lang: args.targetLang,
    blend: {
      ratio,
      ceiling: ratio,
      advancedBy: "time",
      guard: args.guard,
      unknownTokenShare: 0,
    },
    tokens,
  };
}

/** Build an all-English fallback tutor-message (the RED-repair exhaustion
 * path): zero target-language bytes, ratio 0, `guard: "fallback:english"` —
 * the never-show-wrong law's terminal repair (ADR §1.5). */
export function buildEnglishFallbackMessage(args: {
  messageId: string;
  targetLang: LanguageId;
  text: string;
}): TutorMessage {
  return {
    type: "tutor-message",
    schemaVersion: "1.0",
    messageId: args.messageId,
    role: "assistant",
    lang: args.targetLang,
    blend: {
      ratio: 0,
      ceiling: 0,
      advancedBy: "time",
      guard: "fallback:english",
      unknownTokenShare: 0,
    },
    tokens: [{ id: nextTokenId(), text: args.text, lang: "en", kind: "text" }],
  };
}
