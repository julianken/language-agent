/**
 * The fixture-mode HTTP/SSE surface (issue #10). Scope, precisely:
 *
 *   - `GET /api/stream?fixture=<id>&delayMs=<n>` — streams a fixture
 *     tutor-message's `tokens[]` over SSE, tokens FIRST (architecture.md §3
 *     streaming order), token-by-token with a real inter-token delay —
 *     HONEST streaming: each event is written as it happens; nothing
 *     buffers the payload to flush at the end.
 *   - `POST /api/learning-events` — the shared learning-event route.
 *   - `GET /api/learning-events` — verification read-back (e2e asserts the
 *     `renderedScaffold` echo through this).
 *   - static serving of the built web app (e2e/single-origin dev).
 *
 * The REAL turn loop (LLM call → verification gate → directive stamping)
 * replaces the fixture token source in #9; the transport, the header set,
 * and the learning-event route are what #10 owns and #9 inherits.
 *
 * SSE anti-buffering headers per the hosting ADR
 * (docs/decisions/hosting-walking-skeleton.md → "SSE path", citing
 * architecture.md §6's SSE tripwire): `X-Accel-Buffering: no` +
 * `Cache-Control: no-cache, no-transform`, shipped from the first commit;
 * #11 verifies token-by-token arrival through the real proxy chain.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { z } from "zod";
import { LearningEventStore } from "./learning-events.js";

/** Fixture documents are architecture.md §3 tutor-messages (tolerant
 * reader: unknown fields pass through untouched). */
const FixtureTokenSchema = z.looseObject({
  id: z.string().min(1),
  text: z.string(),
  lang: z.string().min(1),
  kind: z.string().min(1),
});

const FixtureDocSchema = z.looseObject({
  type: z.literal("tutor-message"),
  schemaVersion: z.string().min(1),
  messageId: z.string().min(1),
  role: z.string().min(1),
  lang: z.string().min(1),
  tokens: z.array(FixtureTokenSchema),
});

export interface FixtureServerOptions {
  /** Directory of `<fixture-id>.json` tutor-message documents. */
  fixturesDir: string;
  /** Built web app to serve statically (optional — API-only otherwise). */
  webDist?: string | undefined;
}

const FIXTURE_ID = /^[a-z0-9][a-z0-9-]*$/;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function sseEvent(name: string, data: unknown): string {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export interface FixtureServer {
  server: Server;
  learningEvents: LearningEventStore;
}

export function createFixtureServer(opts: FixtureServerOptions): FixtureServer {
  const learningEvents = new LearningEventStore();

  const handleStream = async (
    url: URL,
    res: ServerResponse,
    req: IncomingMessage,
  ): Promise<void> => {
    const fixtureId = url.searchParams.get("fixture") ?? "";
    if (!FIXTURE_ID.test(fixtureId)) {
      json(res, 400, { error: "invalid or missing ?fixture id" });
      return;
    }
    const delayRaw = Number(url.searchParams.get("delayMs") ?? "40");
    const delayMs = Number.isFinite(delayRaw) ? Math.min(Math.max(delayRaw, 0), 1000) : 40;

    let doc: z.infer<typeof FixtureDocSchema>;
    try {
      const raw = await readFile(join(opts.fixturesDir, `${fixtureId}.json`), "utf8");
      doc = FixtureDocSchema.parse(JSON.parse(raw));
    } catch {
      json(res, 404, { error: `fixture '${fixtureId}' not found or invalid` });
      return;
    }

    // The hosting ADR's anti-buffering header set (see file header).
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    });

    let closed = false;
    req.on("close", () => {
      closed = true;
    });

    const { tokens, ...meta } = doc;
    res.write(sseEvent("message-start", meta));
    for (const token of tokens) {
      await sleep(delayMs);
      if (closed) return;
      res.write(sseEvent("token", token)); // written per token — never accumulated
    }
    res.write(sseEvent("message-end", { messageId: doc.messageId }));
    res.end();
  };

  const handleStatic = async (url: URL, res: ServerResponse): Promise<void> => {
    if (!opts.webDist) {
      json(res, 404, { error: "no web dist configured" });
      return;
    }
    const distRoot = resolve(opts.webDist);
    let filePath = normalize(join(distRoot, url.pathname));
    if (!filePath.startsWith(distRoot)) {
      json(res, 403, { error: "forbidden" });
      return;
    }
    if (extname(filePath) === "") filePath = join(distRoot, "index.html"); // SPA fallback
    try {
      const content = await readFile(filePath);
      res.writeHead(200, {
        "content-type": MIME[extname(filePath)] ?? "application/octet-stream",
      });
      res.end(content);
    } catch {
      json(res, 404, { error: "not found" });
    }
  };

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    void (async () => {
      if (req.method === "GET" && url.pathname === "/api/health") {
        json(res, 200, { ok: true });
      } else if (req.method === "GET" && url.pathname === "/api/stream") {
        await handleStream(url, res, req);
      } else if (req.method === "POST" && url.pathname === "/api/learning-events") {
        const parsed = safeAccept(learningEvents, await readBody(req));
        if (parsed.ok) json(res, 201, { ok: true, stored: learningEvents.list().length });
        else json(res, 400, { error: parsed.error });
      } else if (req.method === "GET" && url.pathname === "/api/learning-events") {
        json(res, 200, { events: learningEvents.list() });
      } else if (req.method === "GET") {
        await handleStatic(url, res);
      } else {
        json(res, 405, { error: "method not allowed" });
      }
    })().catch((err: unknown) => {
      // Fail loud in the log, degrade to a JSON 500 — never a hung socket.
      console.error("fixture server error", err);
      if (!res.headersSent) json(res, 500, { error: "internal error" });
      else res.end();
    });
  });

  return { server, learningEvents };
}

function safeAccept(
  store: LearningEventStore,
  body: string,
): { ok: true } | { ok: false; error: string } {
  try {
    store.accept(JSON.parse(body));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "invalid event" };
  }
}
