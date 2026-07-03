/**
 * Server-side SHARED_SECRET enforcement (language-router-gateway plan,
 * Task 6b, R-C): today the env var is set but never checked — under
 * path-routing the edge rate-limit rule keys on a `Host` that ceases to
 * exist (R-C), so the raw Cloud Run `run.app` URL would otherwise be
 * world-open. The Worker (Task 7) injects `x-access-secret` on every
 * proxied request; the server must reject `/api/*` requests that don't
 * carry the matching value. `/api/health` stays unauthenticated (Cloud
 * Run liveness). When `SHARED_SECRET` is unset (every existing dev/e2e
 * environment — see http.test.ts's fixture server and @la/web's
 * LANGUAGE=fake Playwright server, neither of which sets it), enforcement
 * must be a complete no-op, so those suites keep passing unmodified.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { once } from "node:events";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { createFixtureServer, type FixtureServer } from "../http/index.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures");
const ENV_KEY = "SHARED_SECRET";
const originalEnv = process.env[ENV_KEY];

let fixture: FixtureServer;
let base: string;

beforeAll(async () => {
  fixture = createFixtureServer({ fixturesDir: FIXTURES });
  fixture.server.listen(0, "127.0.0.1");
  await once(fixture.server, "listening");
  const addr = fixture.server.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
});

afterAll(() => {
  fixture.server.close();
  if (originalEnv === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = originalEnv;
});

describe("SHARED_SECRET set — /api/* requires x-access-secret", () => {
  beforeEach(() => {
    process.env[ENV_KEY] = "top-secret-value";
  });
  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  it("403s a request with no header at all", async () => {
    const res = await fetch(`${base}/api/learning-events`);
    expect(res.status).toBe(403);
  });

  it("403s a request carrying the wrong secret", async () => {
    const res = await fetch(`${base}/api/learning-events`, {
      headers: { "x-access-secret": "wrong" },
    });
    expect(res.status).toBe(403);
  });

  it("200s a request carrying the correct secret", async () => {
    const res = await fetch(`${base}/api/learning-events`, {
      headers: { "x-access-secret": "top-secret-value" },
    });
    expect(res.status).toBe(200);
  });

  it("never gates /api/health (Cloud Run liveness probe)", async () => {
    const res = await fetch(`${base}/api/health`, { headers: {} });
    expect(res.status).toBe(200);
  });
});

describe("SHARED_SECRET unset — no enforcement (existing dev/e2e default)", () => {
  beforeEach(() => {
    delete process.env[ENV_KEY];
  });

  it("200s /api/learning-events with no header at all", async () => {
    const res = await fetch(`${base}/api/learning-events`);
    expect(res.status).toBe(200);
  });

  it("200s /api/health as always", async () => {
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
  });
});
