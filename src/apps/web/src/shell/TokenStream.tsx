/**
 * `<TokenStream>` — the language-NEUTRAL conversation-line shell. It maps
 * each wire token through the `(lang, kind)` registry and wraps the line in
 * the pack container the registry resolves for the MESSAGE's language.
 *
 * By construction (dual-instance amendment; grep-gated in CI):
 *   - sets NO global text-direction attribute — the pack container owns
 *     every script-structural decision;
 *   - contains zero script-specific assumptions of any kind;
 *   - never branches on a language value — registry lookups are data.
 *
 * Tokens are separated by a plain space; token-internal spacing belongs to
 * the token's own `text` (v0 walking-skeleton simplification — punctuation
 * tokens render with a leading space until a wire-level joiner exists).
 */

import { Fragment } from "react";
import type { RendererRegistry } from "./registry.js";
import type { LearningEventSink, WireToken } from "./stream-types.js";

export interface TokenStreamProps {
  /** The message's language — an opaque registry key from `message-start`. */
  messageLang: string;
  tokens: WireToken[];
  registry: RendererRegistry;
  emitLearningEvent: LearningEventSink;
  /** The message's OPAQUE blend envelope from `message-start` (the same
   * `WireMessageMeta.blend`), forwarded to the pack container untouched. The
   * shell never inspects it and never names a script-structural concept — a
   * pack may derive one (e.g. base direction following blend maturity). */
  blend?: unknown;
}

export function TokenStream({
  messageLang,
  tokens,
  registry,
  emitLearningEvent,
  blend,
}: TokenStreamProps) {
  const Container = registry.containerFor(messageLang);
  return (
    <Container blend={blend}>
      {tokens.map((token, i) => {
        const Token = registry.tokenComponentFor(token.lang, token.kind);
        return (
          <Fragment key={token.id}>
            {i > 0 ? " " : null}
            <Token token={token} emitLearningEvent={emitLearningEvent} />
          </Fragment>
        );
      })}
    </Container>
  );
}
