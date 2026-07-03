/**
 * Fixture-server bin (dev/e2e): binds 127.0.0.1 by default — this is the
 * local fixture surface, not the deploy target (#11 owns the Cloud Run
 * deployment, where the platform injects PORT and the bind is 0.0.0.0).
 *
 *   PORT         listen port (default 8787)
 *   HOST         bind address (default 127.0.0.1)
 *   FIXTURES_DIR fixture documents (default <package>/fixtures)
 *   WEB_DIST     built web app to serve statically (optional)
 */

import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createFixtureServer } from "./server.js";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..", ".."); // dist/http → package root

const port = Number(process.env["PORT"] ?? 8787);
const host = process.env["HOST"] ?? "127.0.0.1";
const fixturesDir = resolve(process.env["FIXTURES_DIR"] ?? join(packageRoot, "fixtures"));
const webDist = process.env["WEB_DIST"] ? resolve(process.env["WEB_DIST"]) : undefined;

const { server } = createFixtureServer({ fixturesDir, webDist });

server.listen(port, host, () => {
  console.info(
    `fixture server on http://${host}:${port} (fixtures: ${fixturesDir}` +
      `${webDist ? `, web: ${webDist}` : ""})`,
  );
});
