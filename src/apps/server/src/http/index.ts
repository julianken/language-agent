/**
 * `@la/server/http` — the fixture-mode HTTP/SSE surface (issue #10). The
 * real turn loop that replaces the fixture token source is #9's.
 */

export { createFixtureServer } from "./server.js";
export type { FixtureServer, FixtureServerOptions } from "./server.js";
export { LearningEventSchema, LearningEventStore } from "./learning-events.js";
