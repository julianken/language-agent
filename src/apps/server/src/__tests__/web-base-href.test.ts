/**
 * Runtime `<base href>` injection (language-router-gateway plan, Task 6,
 * R-B): the web bundle is built ONCE (Vite `base: "./"`, relative asset
 * URLs — @la/web's Task 5) and served unmodified from disk EXCEPT for one
 * server-side rewrite — `<base href="/${LANGUAGE}/">` is spliced into the
 * served `index.html`'s `<head>` at serve time, so the same static bundle
 * resolves its relative asset URLs (and, via `apiUrl()`, its `/api/*`
 * calls) correctly whether it's mounted at `/ar/`, `/zh/`, or (no
 * `webBase` configured — dev/e2e default) plain `/`.
 *
 * The "no injection" case is asserted explicitly because it's exactly
 * what keeps `@la/web`'s existing Playwright e2e suite (LANGUAGE=fake,
 * served at root, no `<base>`) passing unmodified.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createFixtureServer, type FixtureServer } from "../http/index.js";

const FIXTURE_HTML =
  "<!doctype html><html><head><title>t</title></head><body>hi</body></html>";

let webDist: string;
let servers: FixtureServer[] = [];

beforeAll(async () => {
  webDist = await mkdtemp(join(tmpdir(), "la-web-dist-"));
  await writeFile(join(webDist, "index.html"), FIXTURE_HTML);
});

afterAll(async () => {
  for (const s of servers) s.server.close();
  await rm(webDist, { recursive: true, force: true });
});

async function boot(opts: { webBase?: string }): Promise<string> {
  const fixture = createFixtureServer({
    fixturesDir: webDist, // unused by these tests; any real dir works
    webDist,
    webBase: opts.webBase,
  });
  servers.push(fixture);
  fixture.server.listen(0, "127.0.0.1");
  await once(fixture.server, "listening");
  const addr = fixture.server.address() as AddressInfo;
  return `http://127.0.0.1:${addr.port}`;
}

describe("static index.html — <base href> injection", () => {
  it("injects <base href> right after <head> when webBase is configured", async () => {
    const base = await boot({ webBase: "/ar/" });
    const res = await fetch(`${base}/`);
    const html = await res.text();
    expect(html).toContain('<base href="/ar/">');
    expect(html.indexOf('<base href="/ar/">')).toBeLessThan(html.indexOf("<title>"));
  });

  it("injects for the zh instance too", async () => {
    const base = await boot({ webBase: "/zh/" });
    const res = await fetch(`${base}/`);
    const html = await res.text();
    expect(html).toContain('<base href="/zh/">');
  });

  it("injects on the SPA-fallback path too (a deep client route)", async () => {
    const base = await boot({ webBase: "/ar/" });
    const res = await fetch(`${base}/some/deep/route`);
    const html = await res.text();
    expect(html).toContain('<base href="/ar/">');
  });

  it("does NOT inject a <base> when webBase is absent (dev/e2e default, root-served)", async () => {
    const base = await boot({});
    const res = await fetch(`${base}/`);
    const html = await res.text();
    expect(html).not.toContain("<base ");
    expect(html).toBe(FIXTURE_HTML);
  });
});
