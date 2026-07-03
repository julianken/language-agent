/**
 * The real-#9-integration SSE proof (issue #10's remaining AC; ADR §4.3):
 * the same shared matrix's learner messages/fixtures as
 * `e2e-turn.test.ts` (issue #9), but driven through the REAL HTTP/SSE
 * transport (`POST /api/turns` → `GET /api/stream?turn=<id>`) instead of
 * calling `runHotPathTurn` in-process — proving the wiring
 * `e2e-turn.test.ts`'s own file header explicitly left open ("the real
 * turn loop now exists (`runHotPathTurn`) but is not yet wired into
 * `@la/server`'s SSE transport") and the GAPS.md row for #10's TTFT AC
 * restates.
 *
 * **Zero live LLM/model calls on the blocking path** (epic AC, same claim
 * `e2e-turn.test.ts` documents for the in-process call): `assertZeroLiveCalls`
 * below installs a `globalThis.fetch` spy BEFORE `composeApp` runs (so it's
 * in place before the ar leg's generated sidecar client — `openapi-fetch` —
 * resolves `globalThis.fetch` as its default at `createClient()` call time,
 * confirmed by reading `openapi-fetch`'s source) and fails loudly if any
 * intercepted request targets a non-loopback host. Generation is
 * `ReplayCandidateGenerator` (fs-only, zero network I/O of any kind — see
 * `../llm/replay-client.ts`); the only network call either leg can
 * legitimately make is the `ar` leg's loopback call to the locally-booted
 * sidecar.
 *
 * The `ar` leg needs a REAL running `src/sidecars/ar` instance
 * (`SIDECAR_AR_BASE_URL`) and is SKIPPED — never failed — when that env var
 * is unset, exactly `e2e-turn.test.ts`'s convention. CI's `conformance`
 * job sets it for the `ar` leg (same sidecar boot step `e2e-turn.test.ts`
 * already uses) and this suite is REQUIRED to pass there
 * (`pnpm --filter @la/server run test:e2e-sse`).
 */

import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_RUN_TURN_CONFIG } from "@la/engine";
import { AR_ASSETS_ROOT } from "@la/lang-ar/assets";
import { FAKE_ASSETS_ROOT } from "@la/lang-fake";
import { composeApp } from "../composeApp.js";
import { createFixtureServer, type FixtureServer } from "../http/index.js";
import { ReplayCandidateGenerator } from "../llm/replay-client.js";

const SIDECAR_AR_BASE_URL = process.env["SIDECAR_AR_BASE_URL"];
const FIXTURES_ROOT = fileURLToPath(new URL("../../fixtures/llm-replay/", import.meta.url));
const STATIC_FIXTURES = fileURLToPath(new URL("../../fixtures/", import.meta.url));

interface LegCase {
  id: "fake" | "ar";
  requiresEnv?: string;
  config: () => Parameters<typeof composeApp>[0];
  fixturesDir: string;
  greenLearnerMessage: string;
  /** The message whose every bounded attempt gates RED (mirrors
   * `e2e-turn.test.ts`'s `alwaysRedLearnerMessage`). */
  redLearnerMessage: string;
  /** The word that ALWAYS bands RED for this leg — must never appear
   * anywhere in the fallback SSE payload. */
  alwaysRedWord: string;
}

const FAKE_LEG: LegCase = {
  id: "fake",
  config: () => ({
    language: "fake",
    sidecar: { baseUrl: "http://127.0.0.1:0", mode: "mock" },
    assetsRoot: FAKE_ASSETS_ROOT,
    tts: { provider: "test", voice: "v1" },
  }),
  fixturesDir: join(FIXTURES_ROOT, "fake"),
  greenLearnerMessage: "Tell me about zip zap zorg.",
  redLearnerMessage: "This one always fails verification.",
  alwaysRedWord: "qux",
};

const AR_LEG: LegCase = {
  id: "ar",
  requiresEnv: "SIDECAR_AR_BASE_URL",
  config: () => ({
    language: "ar",
    sidecar: { baseUrl: SIDECAR_AR_BASE_URL as string, mode: "real" },
    assetsRoot: AR_ASSETS_ROOT,
    tts: { provider: "test", voice: "v1" },
  }),
  fixturesDir: join(FIXTURES_ROOT, "ar"),
  greenLearnerMessage: "Tell me about the radio.",
  redLearnerMessage: "This one always fails the ar gate.",
  alwaysRedWord: "book",
};

const LEGS: LegCase[] = [FAKE_LEG, AR_LEG];

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

/** The zero-live-calls proof: installs a loopback-only `fetch` spy for the
 * duration of `run`, then restores the real `fetch`. Fails loudly (rather
 * than silently letting the call through) the instant any non-loopback
 * host is requested — see file header for why the spy reliably intercepts
 * the ar leg's generated sidecar client. */
async function assertZeroLiveCalls<T>(run: () => Promise<T>): Promise<T> {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const host = new URL(raw, "http://127.0.0.1").hostname;
    if (host !== "127.0.0.1" && host !== "localhost") {
      throw new Error(
        `zero-live-calls violation: fetch() targeted a non-loopback host (${host}) at ${raw} — ` +
          "the blocking turn path must never make a live network call.",
      );
    }
    return realFetch(input, init);
  }) as typeof fetch;
  try {
    return await run();
  } finally {
    globalThis.fetch = realFetch;
  }
}

async function withRealTurnServer<T>(
  leg: LegCase,
  run: (base: string) => Promise<T>,
): Promise<T> {
  return assertZeroLiveCalls(async () => {
    const app = await composeApp(leg.config());
    const generator = new ReplayCandidateGenerator({ fixturesDir: leg.fixturesDir });
    const server: FixtureServer = createFixtureServer({
      fixturesDir: STATIC_FIXTURES,
      realTurn: { app, generator },
    });
    server.server.listen(0, "127.0.0.1");
    await once(server.server, "listening");
    const addr = server.server.address() as AddressInfo;
    const base = `http://127.0.0.1:${addr.port}`;
    try {
      return await run(base);
    } finally {
      server.server.close();
    }
  });
}

describe.each(LEGS)("real turn over the SSE transport — $id leg", (leg) => {
  const skip = leg.requiresEnv !== undefined && !process.env[leg.requiresEnv];

  it.skipIf(skip)(
    "GREEN: POST /api/turns → the SSE stream carries the REAL verified turn — honest progressive delivery, never RED, zero live LLM calls",
    async () => {
      const { raw, chunkTimes, status } = await withRealTurnServer(leg, async (base) => {
        const create = await fetch(`${base}/api/turns`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ learnerMessage: leg.greenLearnerMessage }),
        });
        expect(create.status).toBe(201);
        const created = (await create.json()) as {
          turnId: string;
          fellBackToEnglish: boolean;
          attempts: number;
        };
        expect(created.fellBackToEnglish).toBe(false);

        const res = await fetch(`${base}/api/stream?turn=${created.turnId}&delayMs=15`);
        const status = res.status;
        expect(res.headers.get("content-type")).toContain("text/event-stream");
        expect(res.headers.get("cache-control")).toBe("no-cache, no-transform");
        expect(res.headers.get("x-accel-buffering")).toBe("no");

        const reader = res.body!.getReader();
        const chunkTimes: number[] = [];
        let raw = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunkTimes.push(performance.now());
          raw += new TextDecoder().decode(value);
        }
        return { raw, chunkTimes, status };
      });

      expect(status).toBe(200);
      // Honest streaming: multiple chunks spread over real wall-clock time
      // — never one end-of-request flush (the same proof http.test.ts runs
      // for fixture mode; now proven for a REAL verified turn too).
      expect(chunkTimes.length).toBeGreaterThanOrEqual(2);

      const events = parseSse(raw);
      expect(events[0]?.event).toBe("message-start");
      expect(events[events.length - 1]?.event).toBe("message-end");
      const tokens = events.filter((e) => e.event === "token");
      expect(tokens.length).toBeGreaterThan(0);
      // Streaming order: tokens first — nothing else between start and end.
      expect(events.length).toBe(tokens.length + 2);

      // never-show-wrong: no RED band ever reaches the wire.
      for (const t of tokens) {
        const band = (t.data as { band?: string }).band;
        expect(band).not.toBe("RED");
      }
    },
  );

  it.skipIf(skip)(
    "RED-fallback: every bounded attempt still RED → the SSE stream carries the whole-message English fallback, zero target-language bytes — the never-show-wrong law",
    async () => {
      const { raw, tokens } = await withRealTurnServer(leg, async (base) => {
        const create = await fetch(`${base}/api/turns`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ learnerMessage: leg.redLearnerMessage }),
        });
        expect(create.status).toBe(201);
        const created = (await create.json()) as { turnId: string; fellBackToEnglish: boolean };
        expect(created.fellBackToEnglish).toBe(true);

        const res = await fetch(`${base}/api/stream?turn=${created.turnId}&delayMs=5`);
        const raw = await res.text();
        const tokens = parseSse(raw).filter((e) => e.event === "token");
        return { raw, tokens };
      });

      expect(tokens).toHaveLength(1); // one whole-message English fallback token
      const token = tokens[0]!.data as { lang: string; kind: string; text: string; band?: string };
      expect(token.lang).toBe("en");
      expect(token.band).toBeUndefined();
      expect(token.text).toBe(DEFAULT_RUN_TURN_CONFIG.englishFallbackText);
      // The always-RED word never reaches the reply, anywhere in the payload.
      expect(raw).not.toContain(leg.alwaysRedWord);
    },
  );

  it.skipIf(skip)("unknown ?turn id 404s (in-memory store, not the fixture-file 404 path)", async () => {
    await withRealTurnServer(leg, async (base) => {
      const res = await fetch(`${base}/api/stream?turn=does-not-exist`);
      expect(res.status).toBe(404);
    });
  });
});

describe("SSE transport — language-agnostic behavior", () => {
  it("neither ?fixture nor ?turn is a 400", async () => {
    await withRealTurnServer(FAKE_LEG, async (base) => {
      const res = await fetch(`${base}/api/stream`);
      expect(res.status).toBe(400);
    });
  });

  it("both ?fixture and ?turn together is a 400", async () => {
    await withRealTurnServer(FAKE_LEG, async (base) => {
      const res = await fetch(`${base}/api/stream?fixture=ar-mixed-line&turn=whatever`);
      expect(res.status).toBe(400);
    });
  });

  it("?fixture=<id> still works unchanged when realTurn is also configured (both modes coexist)", async () => {
    await withRealTurnServer(FAKE_LEG, async (base) => {
      const res = await fetch(`${base}/api/stream?fixture=ar-mixed-line&delayMs=0`);
      expect(res.status).toBe(200);
      await res.text(); // drain
    });
  });
});

describe("POST /api/turns", () => {
  it("404s when real-turn mode isn't configured on this server (fixture-only)", async () => {
    const server = createFixtureServer({ fixturesDir: STATIC_FIXTURES });
    server.server.listen(0, "127.0.0.1");
    await once(server.server, "listening");
    const addr = server.server.address() as AddressInfo;
    const base = `http://127.0.0.1:${addr.port}`;
    try {
      const res = await fetch(`${base}/api/turns`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ learnerMessage: "hi" }),
      });
      expect(res.status).toBe(404);
    } finally {
      server.server.close();
    }
  });

  it("400s a body missing learnerMessage", async () => {
    await withRealTurnServer(FAKE_LEG, async (base) => {
      const res = await fetch(`${base}/api/turns`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });
  });
});
