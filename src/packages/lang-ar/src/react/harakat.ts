/**
 * Ḥarakāt classification + directive-driven subtraction — the pack-side
 * interpretation of the two declared Arabic vowel fade dimensions
 * (`vowelFadeLexical`, `vowelFadeCaseEnding` — ADR §1.4). There is
 * deliberately NO engine-side counterpart: directives are stamped onto the
 * token envelope verbatim; only pack code interprets them (ADR §1.5).
 *
 * Classification heuristic (v0 — the sidecar's analyzer refines this once
 * #9 wires real annotations):
 *   - marks attached to the FINAL base letter are CASE-ENDING marks (the
 *     iʿrāb vowel/tanwīn, e.g. the ٌ of مَكْتَبَةٌ);
 *   - fatḥatān (U+064B) on the PENULTIMATE base letter is also case-ending
 *     when the final base is ا or ى (the ًا adverbial pattern, مَرْحَبًا);
 *   - every other mark is a LEXICAL vocalization mark.
 *
 * Shadda (U+0651) is NEVER stripped: it marks consonant gemination, part of
 * the word's consonant skeleton — DESIGN.md's fade covers the SHORT-VOWEL
 * scaffold (ḥarakāt), not letters. Strippable marks are the tanwīn + short
 * vowels (U+064B–U+0650), sukūn (U+0652) and the dagger alif (U+0670).
 */

import type { FadeLevel, ScaffoldDirective, UnitRef } from "@la/contract";

/** Marks the fade may remove: tanwīn + short vowels (U+064B–U+0650),
 * sukūn (U+0652), dagger alif (U+0670). Shadda (U+0651) is deliberately
 * absent. */
const STRIPPABLE = /[\u064B-\u0650\u0652\u0670]/u;
/** Any Arabic combining mark we classify (shadda included — it must ride
 * with its base when marks are re-attached). */
const ARABIC_MARK = /[\u064B-\u0652\u0670]/u;
/** Final alef (U+0627) / alef maqṣūra (U+0649). */
const FINAL_ALEF = /[\u0627\u0649]/u;
/** Fatḥatān U+064B. */
const FATHATAN = "\u064B";

export type HarakahClass = "lexical" | "caseEnding";

interface Segment {
  base: string;
  marks: string[];
}

function segments(diac: string): Segment[] {
  const out: Segment[] = [];
  for (const ch of diac) {
    if (ARABIC_MARK.test(ch) && out.length > 0) {
      out[out.length - 1]?.marks.push(ch);
    } else {
      out.push({ base: ch, marks: [] });
    }
  }
  return out;
}

/** Classify every strippable mark in a diacritized form. */
export function classifyMarks(
  diac: string,
): Array<{ mark: string; cls: HarakahClass }> {
  const segs = segments(diac);
  const lastIdx = segs.length - 1;
  const result: Array<{ mark: string; cls: HarakahClass }> = [];
  segs.forEach((seg, i) => {
    for (const mark of seg.marks) {
      if (!STRIPPABLE.test(mark)) continue;
      const onFinalBase = i === lastIdx;
      const adverbialTanwin =
        i === lastIdx - 1 &&
        mark === FATHATAN &&
        FINAL_ALEF.test(segs[lastIdx]?.base ?? "");
      result.push({
        mark,
        cls: onFinalBase || adverbialTanwin ? "caseEnding" : "lexical",
      });
    }
  });
  return result;
}

export interface VowelLevels {
  lexical: FadeLevel;
  caseEnding: FadeLevel;
}

/**
 * Rebuild the display form for the given per-dimension levels, by
 * SUBTRACTION from the fully vocalized form (arabic-validation.md §7:
 * "full → partial → none, by subtraction" — never by re-adding marks to a
 * skeleton):
 *   - `full`    → keep every mark of the class;
 *   - `partial` → lexical: keep only the FIRST lexical mark (the reading
 *                 anchor), strip the rest; case-ending: keep (a case ending
 *                 is a single mark slot — only `faded` hides it);
 *   - `faded`   → strip every mark of the class.
 */
export function renderVowels(diac: string, levels: VowelLevels): string {
  const segs = segments(diac);
  const lastIdx = segs.length - 1;
  let lexicalSeen = 0;
  const keepMark = (mark: string, i: number): boolean => {
    if (!STRIPPABLE.test(mark)) return true; // shadda etc. always kept
    const onFinalBase = i === lastIdx;
    const adverbialTanwin =
      i === lastIdx - 1 &&
      mark === FATHATAN &&
      FINAL_ALEF.test(segs[lastIdx]?.base ?? "");
    if (onFinalBase || adverbialTanwin) {
      return levels.caseEnding !== "faded";
    }
    lexicalSeen += 1;
    if (levels.lexical === "full") return true;
    if (levels.lexical === "partial") return lexicalSeen === 1;
    return false;
  };
  return segs
    .map((seg, i) => seg.base + seg.marks.filter((m) => keepMark(m, i)).join(""))
    .join("");
}

export const AR_VOWEL_DIMS = {
  lexical: "vowelFadeLexical",
  caseEnding: "vowelFadeCaseEnding",
} as const;

/**
 * Read the two vowel dimensions out of the stamped directive as two
 * INDEPENDENT per-unit levels (never one per-token level — ADR §1.4). A
 * missing entry defaults to `full`: absent scaffold guidance shows the
 * scaffold (fail-safe for the learner, fail-closed for mastery credit).
 */
export function vowelLevelsFrom(directive: ScaffoldDirective | undefined): VowelLevels {
  const pick = (dim: string): FadeLevel =>
    directive?.fadeLevels.find((f) => f.dim === dim)?.level ?? "full";
  return {
    lexical: pick(AR_VOWEL_DIMS.lexical),
    caseEnding: pick(AR_VOWEL_DIMS.caseEnding),
  };
}

/**
 * The `renderedScaffold` ECHO for a learning event: what the learner
 * actually SAW per fade dimension at render time (contract `LearningEvent`,
 * ADR §1.4). A dimension whose scaffold was even partially visible is
 * `shown` — credit rules are leak-averse, and any visible mark leaks.
 */
export function renderedScaffoldEcho(
  directive: ScaffoldDirective | undefined,
): Record<string, "shown" | "hidden"> {
  const echo: Record<string, "shown" | "hidden"> = {};
  for (const f of directive?.fadeLevels ?? []) {
    const visible = f.level !== "faded";
    const prior = echo[f.dim];
    echo[f.dim] = visible || prior === "shown" ? "shown" : "hidden";
  }
  return echo;
}

/** Every unit the directive names, deduplicated — the event's `unitRefs`. */
export function unitRefsFrom(directive: ScaffoldDirective | undefined): UnitRef[] {
  const seen = new Map<string, UnitRef>();
  for (const f of directive?.fadeLevels ?? []) {
    seen.set(`${f.unit.kind}/${f.unit.id}`, f.unit);
  }
  return [...seen.values()];
}
