/**
 * `describeLanguagePack(name, makePack, { fixtures, fakes })` — the
 * parameterized Vitest conformance suite (ADR §4.1, the Jakarta-TCK
 * pattern scaled down). Each pack's own `conformance.test.ts` instantiates
 * it in ~10 lines; the suite runs the six ADR §4.2 law categories as
 * fast-check properties, all GENERIC over the pack's DECLARED graph:
 *
 *   1. Mastery gating law            (seam 4, per declared `GatingEdge`)
 *   2. The credit-leak law, BOTH halves (seam 4 — universal
 *      same-dimensional for EVERY pack incl. zero-edge packs; declared
 *      cross-dimensional per `CreditLeakEdge`, generic over declared edges)
 *   3. State migration law           (seam 4, per declared `UnitKindDecl`)
 *   4. The anglicize triple          (seam 2 — subtraction-safety,
 *      allowlist inviolability, frame preservation)
 *   5. The scoped RED law            (seam 2/§1.5 — no RED token in a
 *      GENERATED display stream)
 *   6. Seam-5 curriculum laws        (declared `CoverageFloor`s hold over
 *      the full candidate stream, generic over declared floors, incl. the
 *      inclusive-`<=` budget boundary pins)
 *
 * plus the golden-fixture harness (seams 1/3: gate refuses wrong forms;
 * annotations are canonical and round-trip) and declaration-coherence
 * checks. Engine-owned seam-5 behavior (cascade ordering, the novelty
 * budget) is exercised by #9's E2E turn script once the engine cascade
 * exists — the walking skeleton bypasses seam 5 (ADR §5.2 #9), which is
 * why the floor laws here run against the pack's declared predicates
 * directly (amendment Decision 3: the curriculum TCK category runs
 * against the fake alone until real mastery/curriculum wiring lands).
 */

import fc from "fast-check";
import { beforeAll, describe, expect, it } from "vitest";
import type {
  CurriculumPolicy,
  FadeDimId,
  LanguagePack,
  MasteryModel,
  SteeringPolicy,
  UnitRef,
  UnitState,
  VerifiedToken,
} from "@la/contract";
import {
  CONTRACT_VERSION,
  PackManifestSchema,
  deriveCapabilities,
  unitKey,
} from "@la/contract";
import { directivesArb, echoArb, unitStatesArb } from "./arbitraries.js";
import {
  canonicalJson,
  isOrderedSubsequence,
  multisetSubsetViolation,
} from "./canonical-json.js";
import { floorsShouldHold, loadGoldenCases } from "./golden.js";
import type { ConformanceOptions, GoldenCase, MakePack } from "./types.js";
import { TCK_SNAPSHOT } from "./types.js";

interface CaseRun<TAnn> {
  goldenCase: GoldenCase;
  tokens: VerifiedToken<TAnn>[];
  /** Index-aligned with `tokens`: each token's learnable units. */
  units: UnitRef[][];
}

/** A (case, token) coordinate whose token carries ≥1 learnable unit. */
interface UnitBearingPair {
  c: number;
  t: number;
}

export function describeLanguagePack<TAnn = unknown>(
  name: string,
  makePack: MakePack<TAnn>,
  options: ConformanceOptions,
): void {
  const { fixtures, fakes } = options;
  const cases = loadGoldenCases(fixtures.goldenDir);

  describe(`language-pack conformance (TCK): ${name}`, () => {
    let pack: LanguagePack<TAnn>;
    let steering: SteeringPolicy<TAnn>;
    let mastery: MasteryModel;
    let curriculum: CurriculumPolicy;
    let runs: CaseRun<TAnn>[];

    /** Canonical token identity for multiset/subsequence laws. */
    const tokenKey = (token: VerifiedToken<TAnn>): string =>
      canonicalJson({
        spine: token.spine,
        band: token.band,
        ann: pack.annotationCodec.encode(token.annotations),
      });

    const decl = () => pack.masteryModel.declarations;

    const unitBearingPairs = (): UnitBearingPair[] =>
      runs.flatMap((run, c) =>
        run.units.flatMap((units, t) => (units.length > 0 ? [{ c, t }] : [])),
      );

    const allHiddenEcho = (): Record<FadeDimId, "shown" | "hidden"> =>
      Object.fromEntries(decl().fadeDimensions.map((d) => [d, "hidden"]));

    beforeAll(async () => {
      pack = await makePack();
      const ctx = fakes.context;
      const gate = pack.verificationGate(ctx);
      steering = pack.steeringPolicy(ctx);
      mastery = pack.masteryModel.make(ctx);
      curriculum = pack.curriculumPolicy.make(ctx);
      runs = [];
      for (const goldenCase of cases) {
        const tokens = await gate.verify(
          { targetText: goldenCase.targetText, intents: goldenCase.intents },
          { turnId: `tck:${goldenCase.id}` },
        );
        runs.push({
          goldenCase,
          tokens,
          units: tokens.map((t) => mastery.unitsForToken(t.spine, t.annotations)),
        });
      }
    });

    // -----------------------------------------------------------------------
    // Declaration coherence (foundation the law categories build on)
    // -----------------------------------------------------------------------
    describe("declaration coherence", () => {
      it("is a well-formed LanguagePack per the contract manifest schema", () => {
        const parsed = PackManifestSchema.safeParse(pack);
        expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      });

      it("pins meta.contractVersion to the tree's CONTRACT_VERSION and derives capabilities", () => {
        expect(pack.meta.contractVersion).toBe(CONTRACT_VERSION);
        const caps = deriveCapabilities(pack as unknown as LanguagePack);
        expect(caps.direction).toBe(pack.rendererManifest.direction);
        expect(caps.fadeDimensions).toEqual(decl().fadeDimensions);
      });

      it("the instantiated model re-carries the factory's declarations (one source)", () => {
        const project = (d: {
          unitKinds: { kind: string; stateVersion: number }[];
          fadeDimensions: FadeDimId[];
          gatingEdges: unknown;
          creditLeakEdges: unknown;
        }) => ({
          unitKinds: d.unitKinds.map((k) => ({
            kind: k.kind,
            stateVersion: k.stateVersion,
          })),
          fadeDimensions: d.fadeDimensions,
          gatingEdges: d.gatingEdges,
          creditLeakEdges: d.creditLeakEdges,
        });
        expect(project(mastery)).toEqual(project(decl()));
        expect(curriculum.floors.map((f) => f.id)).toEqual(
          pack.curriculumPolicy.floors.map((f) => f.id),
        );
      });

      it("fakes.masteredState is honest: a row at each kind's declared version, valid per its schema", () => {
        for (const kind of decl().unitKinds) {
          const row = fakes.masteredState(kind.kind);
          expect(row.stateVersion, `masteredState(${kind.kind}).stateVersion`).toBe(
            kind.stateVersion,
          );
          expect(
            kind.stateSchema.safeParse(row.state).success,
            `masteredState(${kind.kind}) must validate against the declared stateSchema`,
          ).toBe(true);
        }
      });
    });

    // -----------------------------------------------------------------------
    // Golden-fixture harness — seams 1/3 (gate refuses wrong forms;
    // annotation schema validity; canonical annotation JSON)
    // -----------------------------------------------------------------------
    describe("golden corpus — gate refuses wrong forms; annotations canonical (seams 1/3)", () => {
      it("corpus covers both acceptance and refusal (≥1 GREEN case, ≥1 RED case)", () => {
        const bands = cases.flatMap((c) => c.expected.tokens.map((t) => t.band));
        expect(bands).toContain("GREEN");
        expect(bands).toContain("RED");
      });

      it.each(cases.map((c) => [c.id, c] as const))(
        "golden case %s: expected token stream, bands, and canonical annotation JSON",
        (id, goldenCase) => {
          const run = runs.find((r) => r.goldenCase.id === id);
          expect(run).toBeDefined();
          const tokens = run?.tokens ?? [];
          expect(tokens.map((t) => t.spine.surface)).toEqual(
            goldenCase.expected.tokens.map((t) => t.surface),
          );
          const ids = new Set(tokens.map((t) => t.spine.id));
          expect(ids.size).toBe(tokens.length);
          tokens.forEach((token, i) => {
            const expected = goldenCase.expected.tokens[i];
            if (expected === undefined) return;
            expect(token.band, `tokens[${i}].band`).toBe(expected.band);
            // The gate mints the spine already banded; the top-level band
            // restates it and the two always agree (contract, spine.ts).
            expect(token.spine.band, `tokens[${i}].spine.band`).toBe(token.band);
            expect(token.spine.spanGroup, `tokens[${i}].spanGroup`).toBe(
              expected.spanGroup,
            );
            // Spine presence: the closed shared fields are always minted.
            expect(token.spine.id.length).toBeGreaterThan(0);
            expect(token.spine.lang).toBe(pack.meta.lang);
            expect(token.spine.kind.length).toBeGreaterThan(0);
            expect(token.spine.status.length).toBeGreaterThan(0);
            // Seam 3: payload validates against the pack's canonical zod
            // schema, encodes to the golden canonical JSON, and round-trips.
            expect(
              pack.annotationCodec.schema.safeParse(token.annotations).success,
              `tokens[${i}].annotations must validate against ${pack.annotationCodec.schemaId}`,
            ).toBe(true);
            const encoded = pack.annotationCodec.encode(token.annotations);
            expect(encoded, `tokens[${i}] canonical annotation JSON`).toEqual(
              goldenCase.expected.annotations[i],
            );
            expect(
              pack.annotationCodec.decode(encoded),
              `tokens[${i}] decode(encode(a)) must deep-equal a`,
            ).toEqual(token.annotations);
          });
        },
      );
    });

    // -----------------------------------------------------------------------
    // Law 1 — mastery gating (seam 4)
    // -----------------------------------------------------------------------
    describe("law — mastery gating (seam 4)", () => {
      it("corpus exercises every declared gating edge (non-vacuity)", () => {
        for (const edge of decl().gatingEdges) {
          const exercised = runs.some((run) =>
            run.units.some((units) =>
              units.some((u) => u.kind === edge.gatingUnitKind),
            ),
          );
          expect(
            exercised,
            `no golden token carries a '${edge.gatingUnitKind}' unit — the ` +
              `gating law for edge →${edge.gatedDimension} would be vacuous`,
          ).toBe(true);
        }
      });

      it("driving every gating unit to mastered drives the per-unit gated-dimension level to `faded` (any other-unit states)", () => {
        for (const edge of decl().gatingEdges) {
          const eligible = runs
            .map((_, i) => i)
            .filter((i) =>
              (runs[i]?.units ?? []).some((units) =>
                units.some((u) => u.kind === edge.gatingUnitKind),
              ),
            );
          if (eligible.length === 0) continue; // guarded by the non-vacuity test
          fc.assert(
            fc.property(
              fc.constantFrom(...eligible).chain((i) => {
                const run = runs[i] as CaseRun<TAnn>;
                const allUnits = run.units.flat();
                const pinned = new Map<string, UnitState>();
                for (const unit of allUnits) {
                  if (unit.kind === edge.gatingUnitKind) {
                    pinned.set(unitKey(unit), fakes.masteredState(unit.kind));
                  }
                }
                return fc.tuple(
                  fc.constant(i),
                  unitStatesArb(allUnits, decl(), fakes, pinned),
                );
              }),
              ([i, states]) => {
                const run = runs[i] as CaseRun<TAnn>;
                let sawGatedLevel = false;
                run.tokens.forEach((token, t) => {
                  const units = run.units[t] ?? [];
                  if (!units.some((u) => u.kind === edge.gatingUnitKind)) return;
                  const directive = mastery.scaffoldPlan(
                    { spine: token.spine, annotations: token.annotations, units },
                    states,
                  );
                  for (const entry of directive.fadeLevels) {
                    if (
                      entry.dim === edge.gatedDimension &&
                      entry.unit.kind === edge.gatingUnitKind
                    ) {
                      sawGatedLevel = true;
                      expect(
                        entry.level,
                        `gated dim '${edge.gatedDimension}' on mastered ` +
                          `${edge.gatingUnitKind} unit '${entry.unit.id}'`,
                      ).toBe("faded");
                    }
                  }
                });
                // Per-unit semantics: the plan must actually key the gated
                // dimension by gating unit (the 銀行 per-character case).
                expect(sawGatedLevel).toBe(true);
              },
            ),
          );
        }
      });
    });

    // -----------------------------------------------------------------------
    // Law 2 — the credit-leak law, BOTH halves (seam 4)
    // -----------------------------------------------------------------------
    describe("law — credit leak, both halves (seam 4)", () => {
      it("universal same-dimensional half: evidence on a shown-scaffold dimension writes no state row (every declared dimension of every pack, incl. zero-edge packs)", () => {
        const pairs = unitBearingPairs();
        expect(pairs.length, "corpus must yield unit-bearing tokens").toBeGreaterThan(0);
        fc.assert(
          fc.property(
            fc
              .tuple(
                fc.constantFrom(...pairs),
                fc.constantFrom(...decl().fadeDimensions),
              )
              .chain(([pair, dimension]) =>
                fc.tuple(
                  fc.constant(pair),
                  fc.constant(dimension),
                  echoArb(decl().fadeDimensions, { [dimension]: "shown" }),
                  unitStatesArb(
                    (runs[pair.c] as CaseRun<TAnn>).units.flat(),
                    decl(),
                    fakes,
                  ),
                ),
              ),
            ([pair, dimension, echo, states]) => {
              const run = runs[pair.c] as CaseRun<TAnn>;
              const token = run.tokens[pair.t] as VerifiedToken<TAnn>;
              const event = fakes.makeEvent({
                tokenRef: token.spine.id,
                units: run.units[pair.t] ?? [],
                dimension,
                renderedScaffold: echo,
              });
              // The single event bears evidence on exactly `dimension`,
              // whose own scaffold was shown ⇒ the batch earns nothing.
              expect(mastery.applyEvidence([event], states)).toEqual([]);
            },
          ),
        );
      });

      it("declared cross-dimensional half: for each declared CreditLeakEdge, evidence on the evidence dimension earns nothing while the leaking dimension's scaffold was shown (generic over declared edges)", () => {
        // Zero-edge packs (e.g. ar: `creditLeakEdges: []`) keep FULL
        // same-dimensional coverage from the universal half above; this
        // loop simply has nothing to add for them. @la/lang-fake's declared
        // edge exercises this half in-tree BEFORE #21 (#16's amendment).
        const pairs = unitBearingPairs();
        for (const edge of decl().creditLeakEdges) {
          expect(pairs.length).toBeGreaterThan(0);
          fc.assert(
            fc.property(
              fc.constantFrom(...pairs).chain((pair) =>
                fc.tuple(
                  fc.constant(pair),
                  echoArb(decl().fadeDimensions, {
                    [edge.evidenceDimension]: "hidden",
                    [edge.leakingDimension]: "shown",
                  }),
                  unitStatesArb(
                    (runs[pair.c] as CaseRun<TAnn>).units.flat(),
                    decl(),
                    fakes,
                  ),
                ),
              ),
              ([pair, echo, states]) => {
                const run = runs[pair.c] as CaseRun<TAnn>;
                const token = run.tokens[pair.t] as VerifiedToken<TAnn>;
                const event = fakes.makeEvent({
                  tokenRef: token.spine.id,
                  units: run.units[pair.t] ?? [],
                  dimension: edge.evidenceDimension,
                  renderedScaffold: echo,
                });
                expect(mastery.applyEvidence([event], states)).toEqual([]);
              },
            ),
          );
        }
      });

      it("declared edges are non-vacuous: all-hidden evidence on each edge's evidence dimension CAN earn a delta somewhere in the corpus", () => {
        for (const edge of decl().creditLeakEdges) {
          const earned = unitBearingPairs().some((pair) => {
            const run = runs[pair.c] as CaseRun<TAnn>;
            const token = run.tokens[pair.t] as VerifiedToken<TAnn>;
            const event = fakes.makeEvent({
              tokenRef: token.spine.id,
              units: run.units[pair.t] ?? [],
              dimension: edge.evidenceDimension,
              renderedScaffold: allHiddenEcho(),
            });
            return mastery.applyEvidence([event], new Map()).length > 0;
          });
          expect(
            earned,
            `edge ${edge.evidenceDimension}←${edge.leakingDimension}: ` +
              `evidence on '${edge.evidenceDimension}' never earns credit — ` +
              `the declared edge (and both leak-law halves) would be vacuous`,
          ).toBe(true);
        }
      });

      it("applyEvidence is pure (same events + states ⇒ deep-equal deltas) and dueUnits is monotone under time", () => {
        const pairs = unitBearingPairs();
        fc.assert(
          fc.property(
            fc
              .tuple(
                fc.constantFrom(...pairs),
                fc.constantFrom(...decl().fadeDimensions),
              )
              .chain(([pair, dimension]) =>
                fc.tuple(
                  fc.constant(pair),
                  fc.constant(dimension),
                  echoArb(decl().fadeDimensions, {}),
                  unitStatesArb(
                    (runs[pair.c] as CaseRun<TAnn>).units.flat(),
                    decl(),
                    fakes,
                  ),
                  fc.date({ noInvalidDate: true }),
                  fc.date({ noInvalidDate: true }),
                ),
              ),
            ([pair, dimension, echo, states, dateA, dateB]) => {
              const run = runs[pair.c] as CaseRun<TAnn>;
              const token = run.tokens[pair.t] as VerifiedToken<TAnn>;
              const event = fakes.makeEvent({
                tokenRef: token.spine.id,
                units: run.units[pair.t] ?? [],
                dimension,
                renderedScaffold: echo,
              });
              expect(mastery.applyEvidence([event], states)).toEqual(
                mastery.applyEvidence([event], states),
              );
              const [earlier, later] =
                dateA.getTime() <= dateB.getTime() ? [dateA, dateB] : [dateB, dateA];
              const dueEarlier = mastery
                .dueUnits(states, earlier)
                .map((u) => unitKey(u));
              const dueLater = new Set(
                mastery.dueUnits(states, later).map((u) => unitKey(u)),
              );
              for (const key of dueEarlier) {
                expect(dueLater.has(key), `unit ${key} fell out of dueness`).toBe(
                  true,
                );
              }
            },
          ),
        );
      });
    });

    // -----------------------------------------------------------------------
    // Law 3 — state migration (seam 4)
    // -----------------------------------------------------------------------
    describe("law — state migration (seam 4)", () => {
      it("declared-version rows validate and round-trip through JSON", () => {
        for (const kind of decl().unitKinds) {
          const rows = [
            fakes.masteredState(kind.kind),
            ...(fakes.stateExemplars?.[kind.kind] ?? []),
          ].filter((row) => row.stateVersion === kind.stateVersion);
          expect(rows.length).toBeGreaterThan(0);
          fc.assert(
            fc.property(fc.constantFrom(...rows), (row) => {
              expect(kind.stateSchema.safeParse(row.state).success).toBe(true);
              const roundTripped: unknown = JSON.parse(JSON.stringify(row.state));
              expect(roundTripped).toEqual(row.state);
              expect(kind.stateSchema.safeParse(roundTripped).success).toBe(true);
            }),
          );
        }
      });

      it("migrateState is total over all declared prior versions, pure, and migrated state validates", () => {
        for (const kind of decl().unitKinds) {
          const priorVersions = Array.from(
            { length: Math.max(0, kind.stateVersion - 1) },
            (_, i) => i + 1,
          );
          if (priorVersions.length === 0) continue; // v1 kind: no priors exist
          expect(
            kind.migrateState,
            `unit kind '${kind.kind}' declares stateVersion ${kind.stateVersion} ` +
              `but no migrateState — evolution machinery is part of the ` +
              `declaration from v0 (ADR §1.4, §3.5)`,
          ).toBeDefined();
          for (const version of priorVersions) {
            const exemplars = (fakes.stateExemplars?.[kind.kind] ?? []).filter(
              (row) => row.stateVersion === version,
            );
            expect(
              exemplars.length,
              `unit kind '${kind.kind}': the migration law needs ≥1 ` +
                `stateExemplars row at prior version ${version} as a totality witness`,
            ).toBeGreaterThan(0);
            fc.assert(
              fc.property(fc.constantFrom(...exemplars), (row) => {
                const migrated = kind.migrateState?.(row.stateVersion, row.state);
                expect(
                  kind.stateSchema.safeParse(migrated).success,
                  `migrated v${row.stateVersion} '${kind.kind}' row must ` +
                    `validate at v${kind.stateVersion}`,
                ).toBe(true);
                expect(
                  kind.migrateState?.(row.stateVersion, row.state),
                ).toEqual(migrated);
              }),
            );
          }
        }
      });
    });

    // -----------------------------------------------------------------------
    // Law 4 — the anglicize triple (seam 2)
    // -----------------------------------------------------------------------
    describe("law — the anglicize triple (seam 2)", () => {
      // `anglicizeDown` is pure and NOT idempotence-lawed: its input
      // (`VerifiedToken[]`) and output (`BlendedStream`) types deliberately
      // differ — the asymmetry that keeps "TTS from unverified text"
      // unrepresentable (ADR §4.2).
      it("subtraction-safety, allowlist inviolability, and frame preservation hold under ANY generated directives", () => {
        fc.assert(
          fc.property(
            fc.constantFrom(...runs.map((_, i) => i)).chain((i) => {
              const run = runs[i] as CaseRun<TAnn>;
              return fc.tuple(
                fc.constant(i),
                directivesArb(run.tokens, run.units, decl().fadeDimensions),
              );
            }),
            ([i, directives]) => {
              const run = runs[i] as CaseRun<TAnn>;
              const out = steering.anglicizeDown(run.tokens, directives);
              // Purity: deterministic on same inputs.
              expect(steering.anglicizeDown(run.tokens, directives)).toEqual(out);
              const inputKeys = run.tokens.map(tokenKey);
              const targetKeys = out.segments.flatMap((s) =>
                s.kind === "target" ? [tokenKey(s.token)] : [],
              );
              // (a) subtraction-safety: target-token multiset ⊆ input's —
              // no target byte minted.
              expect(
                multisetSubsetViolation(targetKeys, inputKeys),
              ).toBeUndefined();
              // (c) frame preservation: non-anglicized tokens keep order
              // and content.
              expect(isOrderedSubsequence(targetKeys, inputKeys)).toBe(true);
              // (b) allowlist inviolability: fixture-marked allowlist
              // members are NEVER anglicized, under any directives.
              const markedKeys = run.goldenCase.expected.tokens
                .map((t, idx) => ({ t, idx }))
                .filter(({ t }) => t.neverAnglicize === true)
                .map(({ idx }) => inputKeys[idx] as string);
              for (const key of new Set(markedKeys)) {
                const marked = markedKeys.filter((k) => k === key).length;
                const kept = targetKeys.filter((k) => k === key).length;
                expect(
                  kept,
                  `allowlisted token was anglicized (key ${key})`,
                ).toBeGreaterThanOrEqual(marked);
              }
            },
          ),
        );
      });

      it("corpus exercises the allowlist (≥1 neverAnglicize token) — inviolability is non-vacuous", () => {
        const marked = cases.flatMap((c) =>
          c.expected.tokens.filter((t) => t.neverAnglicize === true),
        );
        expect(marked.length).toBeGreaterThan(0);
      });
    });

    // -----------------------------------------------------------------------
    // Law 5 — the scoped RED law (seam 2 / ADR §1.5)
    // -----------------------------------------------------------------------
    describe("law — scoped RED (no RED token in a GENERATED display stream)", () => {
      // Scope (ADR §1.5): on the GENERATION path the engine's repair rule
      // (promote next-ranked / regenerate — #9's turn loop) removes RED
      // before display; the pack-level law is that the display assembly can
      // never RE-MINT a RED byte from a repaired (RED-free) stream. The
      // future authentic-ingestion surface carries its own pack-owned RED
      // policy and is exempt BY CONSTRUCTION — it does not exist here, and
      // nothing in this suite may ever be pointed at it.
      it("a repaired (RED-free) stream anglicizes to a display stream with zero RED tokens, under ANY directives", () => {
        const eligible = runs
          .map((_, i) => i)
          .filter((i) =>
            (runs[i] as CaseRun<TAnn>).tokens.some((t) => t.band !== "RED"),
          );
        expect(eligible.length).toBeGreaterThan(0);
        fc.assert(
          fc.property(
            fc.constantFrom(...eligible).chain((i) => {
              const run = runs[i] as CaseRun<TAnn>;
              const keep = run.tokens
                .map((_, t) => t)
                .filter((t) => (run.tokens[t] as VerifiedToken<TAnn>).band !== "RED");
              const tokens = keep.map((t) => run.tokens[t] as VerifiedToken<TAnn>);
              const units = keep.map((t) => run.units[t] ?? []);
              return fc.tuple(
                fc.constant(tokens),
                directivesArb(tokens, units, decl().fadeDimensions),
              );
            }),
            ([tokens, directives]) => {
              const out = steering.anglicizeDown(tokens, directives);
              for (const segment of out.segments) {
                if (segment.kind !== "target") continue;
                const token = segment.token as VerifiedToken<TAnn>;
                expect(token.band).not.toBe("RED");
                expect(token.spine.band).not.toBe("RED");
              }
            },
          ),
        );
      });

      it("refusal is real: the corpus's RED cases are banded RED by the gate (asserted per-case by the golden harness)", () => {
        const redExpected = cases.some((c) =>
          c.expected.tokens.some((t) => t.band === "RED"),
        );
        expect(redExpected).toBe(true);
        const redProduced = runs.some((run) =>
          run.tokens.some((t) => t.band === "RED"),
        );
        expect(redProduced).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    // Law 6 — seam-5 curriculum laws (declared CoverageFloors)
    // -----------------------------------------------------------------------
    describe("law — seam-5 curriculum: declared CoverageFloors (seam 5)", () => {
      // Generic over whatever floors a pack declares (zh's dual budget floor
      // is deferred to Phase 3 — v0 declares none, same as ar; a pack
      // declaring none makes this category vacuously green).
      // Cascade ordering and the novelty budget are ENGINE-owned inputs to
      // seam 5 and are exercised by #9's E2E turn script once the engine
      // cascade exists (the walking skeleton bypasses seam 5 — ADR §5.2 #9).
      it("every declared floor holds over the FULL candidate token stream of every winner-marked golden case", () => {
        const winners = runs.filter((run) => floorsShouldHold(run.goldenCase));
        expect(
          winners.length,
          "corpus must contain ≥1 winner-marked (floor-holding) case",
        ).toBeGreaterThan(0);
        for (const run of winners) {
          const stream = run.tokens.map((t) => t.spine);
          for (const floor of curriculum.floors) {
            expect(
              floor.satisfied(stream, TCK_SNAPSHOT),
              `floor '${floor.id}' violated by winner case '${run.goldenCase.id}'`,
            ).toBe(true);
          }
        }
      });

      it("floor predicates are deterministic and the factory's static floors agree with the instance's", () => {
        if (curriculum.floors.length === 0) return;
        fc.assert(
          fc.property(
            fc.tuple(
              fc.constantFrom(...curriculum.floors.map((_, i) => i)),
              fc.constantFrom(...runs.map((_, i) => i)),
            ),
            ([f, c]) => {
              const floor = curriculum.floors[f];
              const factoryFloor = pack.curriculumPolicy.floors[f];
              const stream = (runs[c] as CaseRun<TAnn>).tokens.map((t) => t.spine);
              const verdict = floor?.satisfied(stream, TCK_SNAPSHOT);
              expect(floor?.satisfied(stream, TCK_SNAPSHOT)).toBe(verdict);
              expect(factoryFloor?.satisfied(stream, TCK_SNAPSHOT)).toBe(verdict);
            },
          ),
        );
      });

      it("floor budgets are INCLUSIVE (<=): a stream with its mean exactly at budget passes; one over fails (PR #26 routed SUGGESTION 2)", () => {
        const pins = fixtures.floorBoundaries ?? [];
        // Budget-style floors must pin their boundary; a pack with no
        // budget-style floor declares no pins and this law is vacuous.
        for (const pin of pins) {
          const floor = curriculum.floors.find((f) => f.id === pin.floorId);
          expect(
            floor,
            `floorBoundaries references undeclared floor '${pin.floorId}'`,
          ).toBeDefined();
          expect(
            floor?.satisfied(pin.atBudget, TCK_SNAPSHOT),
            `floor '${pin.floorId}': a stream exactly AT budget must pass (inclusive <=)`,
          ).toBe(true);
          expect(
            floor?.satisfied(pin.overBudget, TCK_SNAPSHOT),
            `floor '${pin.floorId}': a stream over budget must fail`,
          ).toBe(false);
        }
      });

      it("scoreCandidate (when the pack declares it) is deterministic", () => {
        const score = steering.scoreCandidate?.bind(steering);
        if (!score) return; // optional pack hook; defaults to 0 when absent
        fc.assert(
          fc.property(fc.string(), fc.string(), (text, userId) => {
            const a = score({ text }, { userId });
            expect(Number.isFinite(a)).toBe(true);
            expect(score({ text }, { userId })).toBe(a);
          }),
        );
      });
    });
  });
}
