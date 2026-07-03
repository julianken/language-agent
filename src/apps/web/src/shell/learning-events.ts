/**
 * Transport for the shared learning-event return channel (ADR §1.4): pack
 * UI builds the contract `LearningEvent` (with its `renderedScaffold` echo
 * and module-owned payload); the shell only POSTs it to the shared route.
 * Fire-and-forget: evidence reporting must never block or break rendering.
 */

import type { LearningEventSink } from "./stream-types.js";

export function makeLearningEventSink(
  endpoint = "/api/learning-events",
): LearningEventSink {
  return (event) => {
    void fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    }).catch((err: unknown) => {
      console.error("learning-event POST failed", err);
    });
  };
}
