/**
 * The HTTP/SSE surface (issue #10; real-turn wiring is the #10
 * real-#9-integration follow-up). Scope, precisely:
 *
 *   - `GET /api/stream?fixture=<id>&delayMs=<n>` — streams a static fixture
 *     tutor-message's `tokens[]` over SSE (unchanged since #10).
 *   - `POST /api/turns` — REAL mode only (`opts.realTurn` configured):
 *     `{ learnerMessage, messageId?, userId?, topic?, voice? }` runs
 *     `runHotPathTurn` (generate → verify → anglicize; ADR §1.5) to
 *     completion synchronously — generation is `ReplayCandidateGenerator`
 *     (agent-authored corpora, zero live LLM calls), verification is the
 *     pack's REAL gate (e.g. the deterministic, offline-capable `ar`
 *     sidecar) — and stores the resulting `tutor-message` in `TurnStore`,
 *     returning `{ turnId }`.
 *   - `GET /api/stream?turn=<turnId>&delayMs=<n>` — streams that stored
 *     REAL turn's `tokens[]` over SSE. Tokens FIRST (architecture.md §3
 *     streaming order), token-by-token with a real inter-token delay —
 *     HONEST streaming: each event is written as it happens; nothing
 *     buffers the payload to flush at the end. Exactly the same writer as
 *     the fixture leg above (`streamDoc`) — the wire contract is
 *     byte-for-byte identical whether the source is a static fixture or a
 *     real verified turn, which is why #10's renderer needs zero changes
 *     to consume either.
 *   - `POST /api/learning-events` — the shared learning-event route.
 *   - `GET /api/learning-events` — verification read-back (e2e asserts the
 *     `renderedScaffold` echo through this).
 *   - static serving of the built web app (e2e/single-origin dev).
 *
 * The never-show-wrong law holds end-to-end: on the RED-exhaustion path
 * `runHotPathTurn`'s result is already the all-English fallback message
 * (`buildEnglishFallbackMessage` — zero target-language bytes, ADR §1.5);
 * this transport streams whatever `tokens[]` it was handed and never
 * inspects bands itself — the guarantee is upstream, in the turn loop.
 *
 * SSE anti-buffering headers per the hosting ADR
 * (docs/decisions/hosting-walking-skeleton.md → "SSE path", citing
 * architecture.md §6's SSE tripwire): `X-Accel-Buffering: no` +
 * `Cache-Control: no-cache, no-transform`, shipped from the first commit;
 * #11 verifies token-by-token arrival through the real proxy chain.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { z } from "zod";
import type { CandidateGenerator, TutorMessage } from "@la/engine";
import type { App } from "../composeApp.js";
import { runHotPathTurn } from "../hot-path.js";
import { LearningEventStore } from "./learning-events.js";
import { TurnStore } from "./turn-store.js";

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

const CreateTurnSchema = z.object({
  learnerMessage: z.string().min(1),
  messageId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  topic: z.string().min(1).optional(),
  voice: z.object({ provider: z.string().min(1), voice: z.string().min(1) }).optional(),
});

/**
 * Enables `POST /api/turns` + `GET /api/stream?turn=<id>` — the real-#9-
 * integration wiring. `app` is a `composeApp`'d instance (bound to exactly
 * one pack/language for this server process, same as any other `App`
 * consumer); `generator` is the injected `CandidateGenerator` — pass
 * `ReplayCandidateGenerator` to keep the blocking path at zero live LLM
 * calls (the walking-skeleton default; `AnthropicCandidateGenerator` is
 * the real-key alternative, never wired here).
 */
export interface RealTurnOptions {
  app: App;
  generator: CandidateGenerator;
  /** Defaults applied when a `POST /api/turns` body omits the field. */
  defaultUserId?: string;
  defaultTopic?: string;
  defaultVoice?: { provider: string; voice: string };
}

export interface FixtureServerOptions {
  /** Directory of `<fixture-id>.json` tutor-message documents. */
  fixturesDir: string;
  /** Built web app to serve statically (optional — API-only otherwise). */
  webDist?: string | undefined;
  /**
   * Runtime base-path (e.g. `"/ar/"`, `"/zh/"`) spliced into the served
   * `index.html`'s `<head>` as `<base href="...">` (language-router-
   * gateway plan, Task 6, R-B). Absent means root-served — no `<base>` is
   * injected, matching every dev/e2e server today. The web bundle itself
   * is built ONCE with Vite `base: "./"` (relative asset URLs); this is
   * the only place a path prefix is applied, at serve time.
   */
  webBase?: string | undefined;
  /** Real-turn mode (optional — absent means fixture-only, #10's original
   * scope, unchanged). */
  realTurn?: RealTurnOptions | undefined;
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

/**
 * Splices `<base href="${base}">` immediately after the `<head>` open tag
 * (Task 6, R-B). Anchored on the actual `<head ...>` tag rather than a
 * blind string prepend so it survives an attribute on `<head>` (there
 * isn't one today, but this doesn't assume that).
 */
function injectBaseHref(html: string, base: string): string {
  return html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}<base href="${base}">`);
}

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
  /** Real-turn results awaiting/having been streamed (empty and unused
   * when `opts.realTurn` is absent — fixture-only mode). */
  turns: TurnStore;
}

/** Either source `handleStream` can serve, unified: same wire shape
 * (`{ messageId, tokens, ...meta }`), same streaming writer, regardless of
 * whether the tokens came from a static fixture file or a real verified
 * `runHotPathTurn` result. */
type StreamDoc = z.infer<typeof FixtureDocSchema> | TutorMessage;

type DocLookup =
  | { ok: true; doc: StreamDoc }
  | { ok: false; status: number; error: string };

export function createFixtureServer(opts: FixtureServerOptions): FixtureServer {
  const learningEvents = new LearningEventStore();
  const turns = new TurnStore();

  const resolveFixtureDoc = async (fixtureId: string): Promise<DocLookup> => {
    if (!FIXTURE_ID.test(fixtureId)) {
      return { ok: false, status: 400, error: "invalid or missing ?fixture id" };
    }
    try {
      const raw = await readFile(join(opts.fixturesDir, `${fixtureId}.json`), "utf8");
      return { ok: true, doc: FixtureDocSchema.parse(JSON.parse(raw)) };
    } catch {
      return { ok: false, status: 404, error: `fixture '${fixtureId}' not found or invalid` };
    }
  };

  const resolveTurnDoc = (turnId: string): DocLookup => {
    const doc = turns.get(turnId);
    if (!doc) {
      return {
        ok: false,
        status: 404,
        error: `turn '${turnId}' not found (real turns are stored in-memory and don't survive a server restart)`,
      };
    }
    return { ok: true, doc };
  };

  const handleStream = async (
    url: URL,
    res: ServerResponse,
    req: IncomingMessage,
  ): Promise<void> => {
    const fixtureId = url.searchParams.get("fixture");
    const turnId = url.searchParams.get("turn");
    if ((fixtureId === null) === (turnId === null)) {
      json(res, 400, { error: "exactly one of ?fixture=<id> or ?turn=<id> is required" });
      return;
    }
    const delayRaw = Number(url.searchParams.get("delayMs") ?? "40");
    const delayMs = Number.isFinite(delayRaw) ? Math.min(Math.max(delayRaw, 0), 1000) : 40;

    const lookup = fixtureId !== null ? await resolveFixtureDoc(fixtureId) : resolveTurnDoc(turnId as string);
    if (!lookup.ok) {
      json(res, lookup.status, { error: lookup.error });
      return;
    }
    const doc = lookup.doc;

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

  const handleCreateTurn = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!opts.realTurn) {
      json(res, 404, { error: "real-turn mode not configured on this server (no realTurn app/generator wired)" });
      return;
    }
    const { app, generator, defaultUserId, defaultTopic, defaultVoice } = opts.realTurn;

    let body: z.infer<typeof CreateTurnSchema>;
    try {
      body = CreateTurnSchema.parse(JSON.parse(await readBody(req)));
    } catch (err) {
      json(res, 400, { error: err instanceof Error ? err.message : "invalid request body" });
      return;
    }

    // Blocking-path call: generation is whatever CandidateGenerator the
    // caller injected (ReplayCandidateGenerator ⇒ zero live LLM calls —
    // never AnthropicCandidateGenerator here); verification is the pack's
    // REAL gate. On exhaustion, `result.message` is ALREADY the all-English
    // fallback (never-show-wrong) — this handler doesn't special-case it.
    const result = await runHotPathTurn(app, generator, {
      learnerMessage: body.learnerMessage,
      messageId: body.messageId ?? `turn-${randomUUID()}`,
      userId: body.userId ?? defaultUserId ?? "web-learner",
      topic: body.topic ?? defaultTopic ?? "conversation",
      voice: body.voice ?? defaultVoice ?? { provider: "test", voice: "v1" },
    });
    const turnId = turns.put(result.message);
    json(res, 201, {
      turnId,
      fellBackToEnglish: result.fellBackToEnglish,
      attempts: result.attempts,
    });
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
      let content: Buffer | string = await readFile(filePath);
      if (extname(filePath) === ".html" && opts.webBase) {
        content = injectBaseHref(content.toString("utf8"), opts.webBase);
      }
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
      } else if (req.method === "POST" && url.pathname === "/api/turns") {
        await handleCreateTurn(req, res);
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

  return { server, learningEvents, turns };
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
