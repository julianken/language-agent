/**
 * `@la/server/http` — the HTTP/SSE surface. `?fixture=<id>` (issue #10)
 * streams a static fixture doc; `POST /api/turns` + `?turn=<id>` (the #10
 * real-#9-integration follow-up) runs the REAL `runHotPathTurn` loop and
 * streams its verified result over the identical wire contract.
 */

export { createFixtureServer } from "./server.js";
export type { FixtureServer, FixtureServerOptions, RealTurnOptions } from "./server.js";
export { LearningEventSchema, LearningEventStore } from "./learning-events.js";
export { TurnStore } from "./turn-store.js";
