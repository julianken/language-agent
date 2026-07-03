/**
 * The walking-skeleton conversation page: warm-paper canvas, one assistant
 * message bubble streaming over SSE (DESIGN.md: conversation-first layout;
 * the reading surface IS the progress display). The stream source and
 * pacing come from the query string — either a static fixture:
 *
 *   /?fixture=ar-mixed-line&delayMs=60
 *
 * or a REAL turn (the #10 real-#9-integration follow-up) already created
 * via `POST /api/turns`, replayed by its server-assigned id:
 *
 *   /?turn=<turnId>&delayMs=60
 *
 * Both resolve to the same `/api/stream` wire contract
 * (`message-start`/`token`/`message-end`) — this page requires ZERO
 * changes to consume either source.
 *
 * The app (composition layer) knows nothing about any language either —
 * the message's `lang` arrives on the `message-start` event and is handed
 * to the registry as an opaque key.
 */

import { useMemo } from "react";
import {
  apiUrl,
  TokenStream,
  makeLearningEventSink,
  useTokenStream,
} from "../shell/index.js";
import { buildRegistry } from "../packs/register.js";

const registry = buildRegistry();
const emitLearningEvent = makeLearningEventSink(apiUrl("learning-events"));

export function App() {
  const params = new URLSearchParams(window.location.search);
  const turn = params.get("turn");
  // The instance's language comes from its served base path (the server injects
  // `<base href="/ar/">` or `/zh/` per instance) — so the demo default fixture
  // is language-appropriate: the zh instance NEVER falls back to the Arabic
  // sample. An explicit `?fixture=` still overrides.
  const defaultFixture = document.baseURI.includes("/zh/")
    ? "zh-mixed-line"
    : "ar-blend-intro";
  const fixture = turn ? null : (params.get("fixture") ?? defaultFixture);
  const delayMs = params.get("delayMs") ?? "60";
  const streamUrl = useMemo(() => {
    const suffix = `&delayMs=${encodeURIComponent(delayMs)}`;
    return turn
      ? apiUrl(`stream?turn=${encodeURIComponent(turn)}${suffix}`)
      : apiUrl(`stream?fixture=${encodeURIComponent(fixture ?? defaultFixture)}${suffix}`);
  }, [turn, fixture, delayMs, defaultFixture]);

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
          {turn ? `real turn: ${turn}` : `fixture: ${fixture}`}
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
