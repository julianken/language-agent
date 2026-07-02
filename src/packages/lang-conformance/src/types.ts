/**
 * The TCK's instantiation contract (ADR §4.1):
 * `describeLanguagePack(name, makePack, { fixtures, fakes })`.
 *
 * `fixtures` carries the pack's golden corpus and any floor boundary pins;
 * `fakes` carries the pack-provided adapters the generic laws need for the
 * two things a generic harness cannot construct itself: a `PackContext`
 * (assets are pack-shaped) and pack-schema'd values (learning-event
 * payloads, unit-state rows). The laws stay generic over the DECLARED
 * graph (unit kinds, fade dimensions, gating edges, credit-leak edges,
 * coverage floors); the adapters only translate into the pack's own
 * payload/state schemas — they never weaken a law.
 */

import type {
  Band,
  FadeDimId,
  LanguagePack,
  LearningEvent,
  PackContext,
  TokenId,
  TokenSpine,
  TurnIntent,
  UnitRef,
  UnitState,
  UserSnapshot,
} from "@la/contract";

// ---------------------------------------------------------------------------
// Golden fixtures
// ---------------------------------------------------------------------------

/** One expected token of a golden case's verified stream. */
export interface GoldenExpectedToken {
  /** The verified surface text (`TokenSpine.surface`). */
  surface: string;
  band: Band;
  /** Exact expected `TokenSpine.spanGroup`; omit to assert NO span group. */
  spanGroup?: string;
  /**
   * Marks a pack-allowlist member (separable-verb / system-morpheme /
   * classifier analog): the anglicize allowlist-inviolability law asserts
   * this token is NEVER anglicized, under any generated directives.
   */
  neverAnglicize?: boolean;
}

/**
 * One golden case — `(targetText + intents in) → (expected token stream +
 * bands + canonical annotation JSON)`. One focused case per file
 * (ADR §4.2 row 1).
 */
export interface GoldenCase {
  /** Fixture-file basename (without `.json`) — stamped by the loader. */
  id: string;
  /** Human-readable case name. */
  name: string;
  targetText: string;
  intents: TurnIntent[];
  expected: {
    tokens: GoldenExpectedToken[];
    /**
     * Per-token canonical annotation JSON: what the pack codec's
     * `encode(token.annotations)` must deep-equal, index-aligned with
     * `tokens`.
     */
    annotations: unknown[];
    /**
     * Whether this case's stream is a plausible WINNING candidate the
     * seam-5 floor law should hold over. Defaults to "every expected band
     * is GREEN" — refusal probes (RED/YELLOW cases) are gate-honesty
     * fixtures, not winners, and are skipped by the floor law.
     */
    floorsHold?: boolean;
  };
}

/**
 * Boundary pin for a budget-style `CoverageFloor` (the inclusive-`<=`
 * boundary case): a stream sitting EXACTLY at the floor's budget must
 * satisfy it; a stream one step over must not.
 */
export interface FloorBoundaryFixture {
  /** A declared `CoverageFloor.id` of the pack under test. */
  floorId: string;
  /** Must satisfy the floor (mean exactly at budget passes — inclusive). */
  atBudget: TokenSpine[];
  /** Must NOT satisfy the floor (one over the budget fails). */
  overBudget: TokenSpine[];
}

export interface ConformanceFixtures {
  /** Absolute path of the golden-corpus directory (one JSON case per file). */
  goldenDir: string;
  /** Inclusive-`<=` boundary pins for budget-style floors (optional —
   * packs with no budget-style floor declare none). */
  floorBoundaries?: FloorBoundaryFixture[];
}

// ---------------------------------------------------------------------------
// Fakes (pack-provided adapters)
// ---------------------------------------------------------------------------

export interface MakeEventArgs {
  tokenRef: TokenId;
  units: UnitRef[];
  /** The dimension this evidence bears on. */
  dimension: FadeDimId;
  /** The rendered-scaffold echo in force when the evidence was produced. */
  renderedScaffold: Record<FadeDimId, "shown" | "hidden">;
}

export interface ConformanceFakes {
  /** The fake `PackContext` handed to the five factory ports. */
  context: PackContext;
  /**
   * Construct a valid `LearningEvent` bearing evidence on exactly
   * `dimension` (the pack owns its event-payload schema, so a generic
   * harness cannot mint one). The laws control `renderedScaffold`.
   */
  makeEvent(args: MakeEventArgs): LearningEvent;
  /**
   * A state row REPRESENTING mastery for a unit of `kind`, at the kind's
   * declared `stateVersion`. Honesty is checked: the row must validate
   * against the kind's declared `stateSchema`.
   */
  masteredState(kind: string): UnitState;
  /**
   * State-row exemplars per unit kind, at the declared version AND at
   * every declared prior version (the migration law requires a witness
   * for every version `migrateState` claims to be total over).
   */
  stateExemplars?: Record<string, UnitState[]>;
}

// ---------------------------------------------------------------------------
// Entry-point option bag
// ---------------------------------------------------------------------------

export type MakePack<TAnn = unknown> = () =>
  | LanguagePack<TAnn>
  | Promise<LanguagePack<TAnn>>;

export interface ConformanceOptions {
  fixtures: ConformanceFixtures;
  fakes: ConformanceFakes;
}

/** The snapshot handed to floor predicates / `scoreCandidate` by the laws. */
export const TCK_SNAPSHOT: UserSnapshot = { userId: "tck-user" };
