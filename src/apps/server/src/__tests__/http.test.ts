/**
 * Fixture HTTP/SSE surface tests (issue #10):
 *   - the hosting ADR's anti-buffering header set is present on the stream;
 *   - streaming is HONEST — token events arrive in multiple chunks spread
 *     over time, never one end-of-request flush;
 *   - the tutor-message streaming order holds (message-start → tokens →
 *     message-end, tokens first);
 *   - the shared learning-event route validates, stores, and reads back
 *     the `renderedScaffold` echo; malformed events are 400s.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { once } from "node:events";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { createFixtureServer, type FixtureServer } from "../http/index.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures");

let fixture: FixtureServer;
let base: string;

beforeAll(async () => {
  fixture = createFixtureServer({ fixturesDir: FIXTURES });
  fixture.server.listen(0, "127.0.0.1");
  await once(fixture.server, "listening");
  const addr = fixture.server.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  fixture.server.close();
});

interface SseEvent {
  event: string;
  data: unknown;
}

function parseSse(raw: string): SseEvent[] {
  return raw
    .split("\n\n")
    .filter((block) => block.trim().length > 0)
    .map((block) => {
      const event = /^event: (.*)$/m.exec(block)?.[1] ?? "message";
      const data = /^data: (.*)$/m.exec(block)?.[1] ?? "null";
      return { event, data: JSON.parse(data) };
    });
}

describe("GET /api/stream", () => {
  it("sets the anti-buffering SSE headers (hosting ADR → SSE path)", async () => {
    const res = await fetch(`${base}/api/stream?fixture=ar-mixed-line&delayMs=0`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(res.headers.get("x-accel-buffering")).toBe("no");
    await res.text(); // drain
  });

  it("streams token-by-token over time — never one buffered flush", async () => {
    const res = await fetch(`${base}/api/stream?fixture=ar-mixed-line&delayMs=25`);
    const reader = res.body!.getReader();
    const chunkTimes: number[] = [];
    let raw = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunkTimes.push(performance.now());
      raw += new TextDecoder().decode(value);
    }
    // 8 tokens × 25ms pacing: many distinct chunks, spread over real time.
    expect(chunkTimes.length).toBeGreaterThanOrEqual(4);
    const spread = chunkTimes[chunkTimes.length - 1]! - chunkTimes[0]!;
    expect(spread).toBeGreaterThanOrEqual(100);

    const events = parseSse(raw);
    expect(events[0]?.event).toBe("message-start");
    expect(events[events.length - 1]?.event).toBe("message-end");
    const tokens = events.filter((e) => e.event === "token");
    expect(tokens.length).toBe(8);
    // Streaming order: tokens first — nothing else between start and end.
    expect(events.length).toBe(tokens.length + 2);
    const first = tokens[0]?.data as { id: string; lang: string };
    expect(first.id).toBe("t0");
  });

  it("404s an unknown fixture and 400s a malformed id", async () => {
    const missing = await fetch(`${base}/api/stream?fixture=nope-does-not-exist`);
    expect(missing.status).toBe(404);
    const bad = await fetch(`${base}/api/stream?fixture=../etc/passwd`);
    expect(bad.status).toBe(400);
  });
});

describe("the shared learning-event route", () => {
  const event = {
    tokenRef: "t4",
    unitRefs: [{ kind: "lemma", id: "كَبِير#big" }],
    renderedScaffold: { vowelFadeLexical: "hidden", vowelFadeCaseEnding: "shown" },
    payload: { schemaId: "ar-events/v1", action: "breakdown-open" },
  };

  it("accepts a LearningEvent with a renderedScaffold echo and reads it back", async () => {
    const post = await fetch(`${base}/api/learning-events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    });
    expect(post.status).toBe(201);

    const got = await fetch(`${base}/api/learning-events`);
    const body = (await got.json()) as { events: (typeof event)[] };
    const stored = body.events.find((e) => e.tokenRef === "t4");
    expect(stored).toBeDefined();
    expect(stored?.renderedScaffold).toEqual(event.renderedScaffold);
    expect(stored?.payload["schemaId"]).toBe("ar-events/v1");
  });

  it("rejects an event without the echo (400, named validation error)", async () => {
    const { renderedScaffold: _omitted, ...missingEcho } = event;
    const res = await fetch(`${base}/api/learning-events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(missingEcho),
    });
    expect(res.status).toBe(400);
  });
});
