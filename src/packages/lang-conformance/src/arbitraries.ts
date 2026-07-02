/**
 * fast-check arbitraries derived from a pack's DECLARED graph — the
 * randomized inputs the law properties range over. Everything here is
 * generic: dimensions/kinds come from `MasteryDeclarations`, unit-state
 * candidates come from the pack-provided adapters (`masteredState`,
 * `stateExemplars`), and directives range over the full contract enum.
 */

import fc from "fast-check";
import type {
  FadeDimId,
  FadeLevel,
  MasteryDeclarations,
  ScaffoldDirective,
  UnitRef,
  UnitState,
  VerifiedToken,
} from "@la/contract";
import { unitKey } from "@la/contract";
import type { ConformanceFakes } from "./types.js";

const FADE_LEVELS: readonly FadeLevel[] = ["full", "partial", "faded"];

/** A rendered-scaffold echo over the declared dimensions, with `fixed`
 * entries pinned by the law and every other dimension free. */
export function echoArb(
  dimensions: FadeDimId[],
  fixed: Partial<Record<FadeDimId, "shown" | "hidden">>,
): fc.Arbitrary<Record<FadeDimId, "shown" | "hidden">> {
  const free = dimensions.filter((d) => fixed[d] === undefined);
  return fc
    .array(fc.constantFrom<"shown" | "hidden">("shown", "hidden"), {
      minLength: free.length,
      maxLength: free.length,
    })
    .map((values) => {
      const echo: Record<FadeDimId, "shown" | "hidden"> = {};
      free.forEach((dim, i) => {
        echo[dim] = values[i] as "shown" | "hidden";
      });
      for (const [dim, value] of Object.entries(fixed)) {
        if (value !== undefined) echo[dim] = value;
      }
      return echo;
    });
}

/**
 * A hydrated `UnitStateMap` over `units`: `pinned` entries are fixed by
 * the law (e.g. "every gating unit mastered"); every other unit is
 * randomly absent, mastered, or one of the pack's declared-version
 * exemplars — the generic stand-in for "any mastery snapshot".
 */
export function unitStatesArb(
  units: UnitRef[],
  declarations: MasteryDeclarations,
  fakes: ConformanceFakes,
  pinned: ReadonlyMap<string, UnitState> = new Map(),
): fc.Arbitrary<Map<string, UnitState>> {
  const seen = new Set<string>();
  const free: UnitRef[] = [];
  for (const unit of units) {
    const key = unitKey(unit);
    if (seen.has(key) || pinned.has(key)) continue;
    seen.add(key);
    free.push(unit);
  }
  const candidatesByKind = new Map<string, (UnitState | undefined)[]>();
  for (const kind of declarations.unitKinds) {
    const currentExemplars = (fakes.stateExemplars?.[kind.kind] ?? []).filter(
      (row) => row.stateVersion === kind.stateVersion,
    );
    candidatesByKind.set(kind.kind, [
      undefined, // not hydrated
      fakes.masteredState(kind.kind),
      ...currentExemplars,
    ]);
  }
  const perUnit = free.map((unit) =>
    fc.constantFrom(...(candidatesByKind.get(unit.kind) ?? [undefined])),
  );
  return fc.tuple(fc.constant(null), ...perUnit).map(([, ...choices]) => {
    const states = new Map<string, UnitState>(pinned);
    free.forEach((unit, i) => {
      const choice = choices[i];
      if (choice !== undefined) states.set(unitKey(unit), choice);
    });
    return states;
  });
}

/** Index-aligned `ScaffoldDirective`s for a verified stream: every
 * (declared dimension × token unit) fade level, blend decision, and
 * dueness are free — the generic stand-in for "under ANY generated
 * mastery snapshot" (the snapshot reaches `anglicizeDown` only through
 * its directives). */
export function directivesArb(
  tokens: VerifiedToken<unknown>[],
  unitsPerToken: UnitRef[][],
  dimensions: FadeDimId[],
): fc.Arbitrary<ScaffoldDirective[]> {
  const perToken = tokens.map((_token, i) => {
    const units = unitsPerToken[i] ?? [];
    const cells = dimensions.flatMap((dim) => units.map((unit) => ({ dim, unit })));
    const levels = fc.array(fc.constantFrom<FadeLevel>(...FADE_LEVELS), {
      minLength: cells.length,
      maxLength: cells.length,
    });
    return fc
      .tuple(levels, fc.boolean(), fc.boolean())
      .map(([levelChoices, anglicize, dueNow]): ScaffoldDirective => ({
        fadeLevels: cells.map((cell, c) => ({
          dim: cell.dim,
          unit: cell.unit,
          level: levelChoices[c] as FadeLevel,
        })),
        blend: { anglicize },
        dueness: { dueNow },
      }));
  });
  return fc.tuple(fc.constant(null), ...perToken).map(([, ...ds]) => ds);
}

/** A uniformly-chosen index into a non-empty eligible list. */
export function indexArb(eligible: number[]): fc.Arbitrary<number> {
  return fc.constantFrom(...eligible);
}
