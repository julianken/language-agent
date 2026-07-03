/**
 * Per-character ruby classification + subtraction-render + the `UnitRef`
 * convention for `@la/lang-zh` — the zh analog of `@la/lang-ar/src/react/
 * harakat.ts`. There is deliberately NO engine-side counterpart: directives
 * are stamped onto the token envelope verbatim; only pack code interprets
 * them (ADR §1.5).
 *
 * The Latent-C gating UNIT is the CHARACTER, not the token (design
 * §3.1/§3.2, the S1b harakat-lesson analog folded into the amended issue
 * body): segmental pinyin fades per character within a word, because an
 * opaque glyph has no sound-it-out fallback. Erhua fusion is the ONE
 * sanctioned break from 1:1 character↔ruby alignment (design §3.2) — a
 * fused syllable's ruby rides the PRECEDING character's slot, never its
 * own `<rt>`.
 */

import type { FadeLevel, ScaffoldDirective, UnitRef } from "@la/contract";
import type { ZhAnnotations } from "../annotations.js";

/** The two unit kinds this pack declares (ADR §1.4: "zh: 2 kinds"). */
export const ZH_WORD_UNIT_KIND = "word";
export const ZH_CHARACTER_UNIT_KIND = "character";

/** The three declared fade dimensions (design §3.1; ADR §1.4 "zh:
 * ['meaning','segmentalPinyin','tone']"). */
export const ZH_FADE_DIMS = {
  meaning: "meaning",
  segmentalPinyin: "segmentalPinyin",
  tone: "tone",
} as const;

/** The pack-canonical word `UnitRef`, keyed on the mastery key (design
 * §7.1's `reading_id`) — fixtures and the turn loop follow THIS
 * convention; it is owned here, not by any fixture. */
export function zhWordUnitRef(readingId: string): UnitRef {
  return { kind: ZH_WORD_UNIT_KIND, id: readingId };
}

/** The pack-canonical character `UnitRef` — keyed on the bare Traditional
 * character (Latent C tracks P(known) per CHARACTER, recurring across
 * every word that contains it — design §2.2). */
export function zhCharacterUnitRef(char: string): UnitRef {
  return { kind: ZH_CHARACTER_UNIT_KIND, id: char };
}

/** Every character unit a token's annotations name, in surface order. */
export function zhCharacterUnitRefs(ann: ZhAnnotations): UnitRef[] {
  return ann.perCharacter.map((c) => zhCharacterUnitRef(c.char));
}

/**
 * One ruby-renderable slot: a base character (or, for the one sanctioned
 * erhua-fusion case, a base character with its fused successor folded in)
 * plus the surface syllable to show above it and that character's own
 * fade level for the `segmentalPinyin` dimension.
 */
export interface RubySlot {
  /** The base character(s) this slot's `<rb>` renders — length 2 only for
   * an erhua-fused slot (design §3.2/§8.2: authored as a single rb+rt unit
   * spanning two glyphs). */
  baseChars: string;
  /** The surface syllable shown in `<rt>` (already sandhi/tone-resolved;
   * the ruby band ALWAYS renders the surface layer, never citation —
   * design §3.2/§3.3). Undefined when this character's segmental pinyin
   * has faded away by subtraction. */
  surfaceSyllable: string | undefined;
  /** This slot's own `segmentalPinyin` fade level (per-CHARACTER — the
   * gating unit is the first, base, character of an erhua-fused slot). */
  segmentalLevel: FadeLevel;
  /** Whether tone digit 5 (neutral) applies to this slot's syllable. */
  neutralTone: boolean;
  /** The tone digit (1–5) this slot's syllable carries — the late-state
   * character-borne cue reads this even after `surfaceSyllable` fades. */
  tone: number | undefined;
  /** True for the ONE sanctioned erhua-fusion slot (design §3.2): the
   * fused syllable rides this slot rather than a separate `<rt>`. */
  erhuaFused: boolean;
}

/**
 * Build the per-character ruby slots for a word/single-kind token's
 * annotations, folding any erhua-fused syllable into its preceding
 * character's slot (v0 ships zero erhua occurrences — #20's C6 sliver
 * constraint — so `erhuaSlots` is always `[]` today and every slot is
 * 1:1; this function still implements the fold structurally so it never
 * needs to change shape when a future sliver adds erhua).
 */
export function buildRubySlots(ann: ZhAnnotations): RubySlot[] {
  const erhua = new Set(ann.erhuaSlots);
  const slots: RubySlot[] = [];
  let i = 0;
  while (i < ann.perCharacter.length) {
    const unit = ann.perCharacter[i];
    if (unit === undefined) break;
    const fuseNext = erhua.has(i + 1) && i + 1 < ann.perCharacter.length;
    const nextChar = fuseNext ? ann.perCharacter[i + 1]?.char : undefined;
    slots.push({
      baseChars: fuseNext && nextChar !== undefined ? unit.char + nextChar : unit.char,
      surfaceSyllable: ann.surfacePinyin[i],
      // Per-character level is supplied by the caller (scaffoldPlan reads
      // ZH_CHARACTER_UNIT_KIND directives keyed on `unit.char`); this pure
      // builder defaults to "full" and callers overlay real levels via
      // `withSegmentalLevels`.
      segmentalLevel: "full",
      neutralTone: ann.neutralToneSlots.includes(i),
      tone: ann.toneTrack[i],
      erhuaFused: fuseNext,
    });
    i += fuseNext ? 2 : 1;
  }
  return slots;
}

/** Overlay per-character `segmentalPinyin` fade levels (read from the
 * stamped directive, per-(dimension × unit) — ADR §1.4) onto ruby slots
 * built by `buildRubySlots`, keyed by each slot's BASE character. */
export function withSegmentalLevels(
  slots: RubySlot[],
  directive: ScaffoldDirective | undefined,
): RubySlot[] {
  const levelFor = (char: string): FadeLevel =>
    directive?.fadeLevels.find(
      (f) => f.dim === ZH_FADE_DIMS.segmentalPinyin && f.unit.kind === ZH_CHARACTER_UNIT_KIND && f.unit.id === char,
    )?.level ?? "full";
  return slots.map((slot) => ({
    ...slot,
    // The gating unit for a fused slot is its FIRST (base) character.
    segmentalLevel: levelFor(slot.baseChars[0] ?? slot.baseChars),
  }));
}

/** Subtraction render of one ruby slot's `<rt>` content: `full`/`partial`
 * show the surface syllable (partial and full are equivalent for a single
 * syllable — there is no sub-syllable partial state, unlike Arabic's
 * multi-mark ḥarakāt case); `faded` hides it (opacity, never removal —
 * the caller reserves layout height; see `ZhWordToken.tsx`). */
export function renderRubyText(slot: RubySlot): string | undefined {
  if (slot.segmentalLevel === "faded") return undefined;
  return slot.surfaceSyllable;
}

/** The `renderedScaffold` ECHO for a learning event (mirrors `@la/lang-ar`
 * harakat.ts): what the learner actually SAW per fade dimension at render
 * time. A dimension whose scaffold was even partially visible is `shown`
 * — credit rules are leak-averse. */
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
