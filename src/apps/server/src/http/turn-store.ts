/**
 * In-memory store for REAL turn results (issue #10's real-#9-integration
 * follow-up). `POST /api/turns` runs `runHotPathTurn` to completion
 * synchronously and writes the resulting `tutor-message` here, keyed by a
 * server-generated `turnId`; `GET /api/stream?turn=<turnId>` reads it back
 * and re-plays its already-verified `tokens[]` over SSE with a real
 * inter-token delay — the exact same honest, per-token-write streaming
 * path `?fixture=<id>` already used (see `server.ts`). Nothing here talks
 * to an LLM or a sidecar; the write happens once, after verification is
 * already done.
 *
 * Deliberately NOT durable (process-memory only, capped, FIFO-evicted) —
 * matching `LearningEventStore`'s existing walking-skeleton posture: this
 * is a transport-proof store, not learner-state persistence.
 */

import { randomUUID } from "node:crypto";
import type { TutorMessage } from "@la/engine";

const MAX_TURNS = 1_000;

export class TurnStore {
  private readonly turns = new Map<string, TutorMessage>();
  private readonly insertionOrder: string[] = [];

  /** Store a computed turn result; returns the id the SSE leg reads back. */
  put(message: TutorMessage): string {
    const turnId = randomUUID();
    this.turns.set(turnId, message);
    this.insertionOrder.push(turnId);
    if (this.insertionOrder.length > MAX_TURNS) {
      const oldest = this.insertionOrder.shift();
      if (oldest !== undefined) this.turns.delete(oldest);
    }
    return turnId;
  }

  get(turnId: string): TutorMessage | undefined {
    return this.turns.get(turnId);
  }
}
