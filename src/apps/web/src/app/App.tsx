/**
 * The walking-skeleton conversation page: warm-paper canvas, one assistant
 * message bubble streaming over SSE (DESIGN.md: conversation-first layout;
 * the reading surface IS the progress display). Fixture and pacing come
 * from the query string:
 *
 *   /?fixture=ar-mixed-line&delayMs=60
 *
 * The app (composition layer) knows nothing about any language either —
 * the message's `lang` arrives on the `message-start` event and is handed
 * to the registry as an opaque key.
 */

import { useMemo } from "react";
import {
  TokenStream,
  makeLearningEventSink,
  useTokenStream,
} from "../shell/index.js";
import { buildRegistry } from "../packs/register.js";

const registry = buildRegistry();
const emitLearningEvent = makeLearningEventSink();

export function App() {
  const params = new URLSearchParams(window.location.search);
  const fixture = params.get("fixture") ?? "ar-mixed-line";
  const delayMs = params.get("delayMs") ?? "60";
  const streamUrl = useMemo(
    () =>
      `/api/stream?fixture=${encodeURIComponent(fixture)}&delayMs=${encodeURIComponent(delayMs)}`,
    [fixture, delayMs],
  );

  const stream = useTokenStream(streamUrl);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--la-color-canvas)",
        padding: "var(--la-space-lg) var(--la-space-base)",
        boxSizing: "border-box",
      }}
    >
      <header style={{ maxWidth: 760, margin: "0 auto var(--la-space-md)" }}>
        <h1
          style={{
            fontFamily: "var(--la-font-ui)",
            fontSize: "var(--la-type-ui-title-lg-size)",
            lineHeight: "var(--la-type-ui-title-lg-line-height)",
            fontWeight: 600,
            color: "var(--la-color-ink)",
            margin: 0,
          }}
        >
          language-agent — walking skeleton
        </h1>
        <p
          style={{
            fontFamily: "var(--la-font-ui)",
            fontSize: "var(--la-type-ui-label-size)",
            letterSpacing: "0.4px",
            textTransform: "uppercase",
            color: "var(--la-color-muted)",
            margin: "var(--la-space-xxs) 0 0",
          }}
        >
          fixture: {fixture}
        </p>
      </header>

      <section
        aria-label="conversation"
        style={{ maxWidth: 760, margin: "0 auto" }}
      >
        <article
          data-message-bubble
          data-stream-done={stream.done ? "true" : "false"}
          style={{
            background: "var(--la-color-surface-card)",
            border: "1px solid var(--la-color-hairline)",
            borderRadius: "var(--la-radius-xl)",
            padding: "var(--la-space-md) var(--la-space-lg)",
          }}
        >
          <TokenStream
            messageLang={stream.meta?.lang ?? ""}
            tokens={stream.tokens}
            registry={registry}
            emitLearningEvent={emitLearningEvent}
          />
        </article>

        <footer
          style={{
            fontFamily: "var(--la-font-ui)",
            fontSize: 13,
            color: "var(--la-color-muted)",
            marginTop: "var(--la-space-xs)",
          }}
        >
          {stream.error ? (
            <span data-stream-error>{stream.error}</span>
          ) : (
            <span>
              {stream.done ? "stream complete" : "streaming…"}
              {stream.firstTokenMs !== undefined && (
                <>
                  {" · replay first-token "}
                  <span data-first-token-ms={stream.firstTokenMs}>
                    {stream.firstTokenMs}ms
                  </span>
                  {" (plumbing-only, non-AC)"}
                </>
              )}
            </span>
          )}
        </footer>
      </section>
    </main>
  );
}
