/**
 * probeSidecar unit tests against a real (mock) HTTP server — the AC's
 * "unit-tested against at least a mock HTTP server". The fixtures here are
 * TEST-LOCAL shapes, not sidecar endpoint definitions: the OpenAPI document
 * is #7's exclusively.
 */

import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertProbesPass, probeSidecar } from "../probe-sidecar.js";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/mock/capabilities") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ legs: ["a", "b"], extra: "ignored-by-subset" }));
      return;
    }
    if (req.method === "POST" && req.url === "/mock/echo") {
      let body = "";
      req.on("data", (chunk: string) => (body += chunk));
      req.on("end", () => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ echoed: JSON.parse(body) as unknown }));
      });
      return;
    }
    if (req.url === "/mock/not-json") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("plain text");
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("mock server did not bind a port");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

describe("probeSidecar", () => {
  it("passes on matching status + structural body subset (extra keys allowed)", async () => {
    const results = await probeSidecar(baseUrl, [
      {
        name: "capabilities",
        request: { path: "/mock/capabilities" },
        expect: { status: 200, bodySubset: { legs: ["a", "b"] } },
      },
    ]);
    expect(results).toEqual([{ name: "capabilities", pass: true, detail: "ok" }]);
    expect(() => assertProbesPass(results)).not.toThrow();
  });

  it("accepts the structural { baseUrl } target (the shape the future generated client satisfies)", async () => {
    const results = await probeSidecar({ baseUrl }, [
      {
        name: "status-only",
        request: { path: "/mock/capabilities" },
        expect: { status: 200 },
      },
    ]);
    expect(results[0]?.pass).toBe(true);
  });

  it("POSTs a JSON body and matches nested subsets", async () => {
    const results = await probeSidecar(baseUrl, [
      {
        name: "echo",
        request: {
          path: "/mock/echo",
          method: "POST",
          body: { targetText: "wug bo", intents: [] },
        },
        expect: {
          status: 200,
          bodySubset: { echoed: { targetText: "wug bo" } },
        },
      },
    ]);
    expect(results[0]).toEqual({ name: "echo", pass: true, detail: "ok" });
  });

  it("fails on a status mismatch with the observed status in the detail", async () => {
    const results = await probeSidecar(baseUrl, [
      {
        name: "missing",
        request: { path: "/mock/definitely-missing" },
        expect: { status: 200 },
      },
    ]);
    expect(results[0]?.pass).toBe(false);
    expect(results[0]?.detail).toContain("404");
  });

  it("fails on a body-subset mismatch, naming the mismatching path", async () => {
    const results = await probeSidecar(baseUrl, [
      {
        name: "wrong-legs",
        request: { path: "/mock/capabilities" },
        expect: { status: 200, bodySubset: { legs: ["a", "WRONG"] } },
      },
    ]);
    expect(results[0]?.pass).toBe(false);
    expect(results[0]?.detail).toContain("$.legs[1]");
  });

  it("fails (never throws) when a JSON body was expected but not returned", async () => {
    const results = await probeSidecar(baseUrl, [
      {
        name: "not-json",
        request: { path: "/mock/not-json" },
        expect: { status: 200, bodySubset: { anything: true } },
      },
    ]);
    expect(results[0]?.pass).toBe(false);
    expect(results[0]?.detail).toContain("JSON");
  });

  it("reports an unreachable sidecar as a failing probe (never throws)", async () => {
    const results = await probeSidecar("http://127.0.0.1:1", [
      {
        name: "unreachable",
        request: { path: "/anything" },
        expect: { status: 200 },
      },
    ]);
    expect(results[0]?.pass).toBe(false);
    expect(results[0]?.detail).toContain("request failed");
  });

  it("assertProbesPass throws listing every failing probe", async () => {
    const results = await probeSidecar(baseUrl, [
      {
        name: "ok",
        request: { path: "/mock/capabilities" },
        expect: { status: 200 },
      },
      {
        name: "bad-1",
        request: { path: "/mock/missing" },
        expect: { status: 200 },
      },
      {
        name: "bad-2",
        request: { path: "/mock/capabilities" },
        expect: { status: 418 },
      },
    ]);
    expect(() => assertProbesPass(results)).toThrow(/bad-1[\s\S]*bad-2/);
  });
});
