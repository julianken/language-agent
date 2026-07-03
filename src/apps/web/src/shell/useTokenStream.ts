/**
 * SSE client for the tutor-message stream — tokens arrive FIRST and paint
 * as they arrive (architecture.md §3 streaming order). Wire format:
 * `message-start` (meta) → N × `token` → `message-end`. The client closes
 * the EventSource on `message-end`: SSE auto-reconnect would otherwise
 * replay the fixture stream forever.
 *
 * `firstTokenMs` is the REPLAY-path time-to-first-token — plumbing-only,
 * explicitly NOT the issue's TTFT acceptance number, which is defined over
 * a real streamed model response (deferred until a live product key; see
 * GAPS.md).
 */

import { useEffect, useRef, useState } from "react";
import type { WireMessageMeta, WireToken } from "./stream-types.js";

export interface TokenStreamState {
  meta?: WireMessageMeta;
  tokens: WireToken[];
  done: boolean;
  error?: string;
  /** Replay-path first-token latency in ms (plumbing-only, non-AC). */
  firstTokenMs?: number;
}

export function useTokenStream(url: string): TokenStreamState {
  const [state, setState] = useState<TokenStreamState>({ tokens: [], done: false });
  const startedAt = useRef(0);

  useEffect(() => {
    setState({ tokens: [], done: false });
    startedAt.current = performance.now();
    const source = new EventSource(url);

    source.addEventListener("message-start", (e) => {
      const meta = JSON.parse((e as MessageEvent<string>).data) as WireMessageMeta;
      setState((s) => ({ ...s, meta }));
    });

    source.addEventListener("token", (e) => {
      const token = JSON.parse((e as MessageEvent<string>).data) as WireToken;
      const elapsed = Math.round(performance.now() - startedAt.current);
      setState((s) => ({
        ...s,
        tokens: [...s.tokens, token],
        firstTokenMs: s.firstTokenMs ?? elapsed,
      }));
    });

    source.addEventListener("message-end", () => {
      source.close();
      setState((s) => ({ ...s, done: true }));
    });

    source.onerror = () => {
      source.close();
      setState((s) => (s.done ? s : { ...s, done: true, error: "stream failed" }));
    };

    return () => source.close();
  }, [url]);

  return state;
}
