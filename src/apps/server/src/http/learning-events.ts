/**
 * The shared learning-event route's validation + store (ADR §1.4): pack UI
 * posts contract `LearningEvent`s — `tokenRef`, `unitRefs`, the
 * `renderedScaffold` ECHO of what the learner actually saw per fade
 * dimension, and a module-owned `payload` envelope named by `schemaId`.
 *
 * Store: in-memory, append-only, capped — deliberately. The walking
 * skeleton's AC is that the shared route ACCEPTS the event and the echo is
 * verifiable end-to-end (the GET below exists for exactly that); durable
 * learner-state persistence is the mastery seam's storage work and lands
 * with #9's turn loop, not here.
 */

import { z } from "zod";
import type { LearningEvent } from "@la/contract";

const UnitRefSchema = z.object({
  kind: z.string().min(1),
  id: z.string().min(1),
});

/** Runtime mirror of the contract `LearningEvent` interface (the contract
 * exports types, not zod schemas, for the spine — validated here because
 * this is a wire boundary). */
export const LearningEventSchema = z.object({
  tokenRef: z.string().min(1),
  unitRefs: z.array(UnitRefSchema),
  renderedScaffold: z.record(z.string(), z.enum(["shown", "hidden"])),
  payload: z.looseObject({ schemaId: z.string().min(1) }),
});

const MAX_EVENTS = 10_000;

export class LearningEventStore {
  private readonly events: LearningEvent[] = [];

  /** Validate + append. Throws ZodError on a malformed event. */
  accept(raw: unknown): LearningEvent {
    const event = LearningEventSchema.parse(raw) as LearningEvent;
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) this.events.shift();
    return event;
  }

  list(): readonly LearningEvent[] {
    return this.events;
  }
}
