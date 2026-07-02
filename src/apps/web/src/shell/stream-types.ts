/**
 * Wire types for the streamed tutor message — the language-NEUTRAL shape
 * the shell renders. Follows `docs/plans/architecture.md` §3 (`id`, `text`,
 * `lang`, `kind` required per token; everything else lazily hydrated /
 * stamped) with the contract spine's names for the shared slots (`status`,
 * `band`, `spanGroup` — the ADR §1.5 SSE schema: the ONLY token fields
 * shared client code touches) plus the per-token `ScaffoldDirective`
 * envelope stamped verbatim by the server (ADR §1.4). The shell never
 * interprets the directive's levels — it hands the envelope, opaque, to
 * the pack component the registry resolves.
 *
 * `@la/lang-ar/react` and `@la/lang-fake/react` carry STRUCTURAL mirrors
 * of these types (`renderer-types.ts` in each): packs must not import the
 * app (dependency cycle — ADR §2.4 rule d). Keep the copies
 * field-identical.
 */

import type { ScaffoldDirective, LearningEvent } from "@la/contract";

export interface WireToken {
  id: string;
  text: string;
  /** Per-token language tag — the blend made concrete (architecture.md §3).
   * OPAQUE to the shell: it is a registry key, never a branch condition. */
  lang: string;
  /** Pack-declared token kind (contract `TokenKind` discipline): a registry
   * key, never a branch condition. */
  kind: string;
  status?: string;
  band?: "GREEN" | "YELLOW" | "RED";
  spanGroup?: string;
  /** Per-language payload behind the spine — opaque here; pack components
   * decode it with their own canonical zod schema (seam 3). */
  annotations?: unknown;
  /** Stamped scaffold envelope — opaque here; pack code interprets it
   * (ADR §1.5: there is deliberately no engine-side applier). */
  directive?: ScaffoldDirective;
}

/** The `message-start` SSE event payload (tutor-message minus tokens). */
export interface WireMessageMeta {
  type: string;
  schemaVersion: string;
  messageId: string;
  role: string;
  /** The message's instance language — the registry key for the pack
   * container. Opaque to the shell. */
  lang: string;
  blend?: unknown;
}

export type LearningEventSink = (event: LearningEvent) => void;

export interface TokenRendererProps {
  token: WireToken;
  emitLearningEvent: LearningEventSink;
}
