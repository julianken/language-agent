"""Leg (d) — the rule-based sandhi / 不-一 / neutral-tone resolver
(legId ``sandhi-resolver``), plus the conservative third-tone grouping.

Shifts are applied only where the curated enumeration marks them applicable
(issue #19 step 2(d)): the 不/一 shifts ride the context-table entries'
surface readings (curation-verified per context, consistency-asserted here),
and within-word third-tone groupings ride the tuples' curated surfacePinyin.
The resolver itself applies exactly ONE blind transform — the deterministic
two-syllable 3-3 → 2-3 shift, which has no grouping ambiguity.

Third-tone grouping is conservative-by-construction (dual-instance
amendment): ALL third-tone runs of 3+ syllables spanning more than one word
→ candidate-level regenerate (no self-judging ambiguity detector sits on the
display path); within-word 3+ runs display GREEN only because their grouping
was curated (a within-word 3+ run whose curated surface still stacks third
tones is fail-closed → regenerate).
"""

from __future__ import annotations

from . import LEG_SANDHI, Regenerate, Unit
from ..pinyin import tone_of, with_tone
from ..state import Tables


def _consistency_check(units: list[Unit], idx: int, next_tone: int | None) -> None:
    """A context entry's surface shift must be applicable in this occurrence
    (fail-closed: an inconsistent enumeration never displays)."""
    unit = units[idx]
    base, surface = unit.base[0], unit.surface_py[0]
    if base == surface:
        return
    b_tone, s_tone = tone_of(base), tone_of(surface)
    char = unit.surface
    if char == "不" and s_tone == 2 and next_tone != 4:
        raise Regenerate(
            LEG_SANDHI,
            "inconsistent-enumeration",
            f"不 pinned surface bu2 but following tone is {next_tone} (shift applies before tone 4 only)",
        )
    if char == "一":
        if s_tone == 2 and next_tone != 4:
            raise Regenerate(
                LEG_SANDHI,
                "inconsistent-enumeration",
                f"一 pinned surface yi2 but following tone is {next_tone} (yí applies before tone 4 only)",
            )
        if s_tone == 4 and next_tone not in (1, 2, 3):
            raise Regenerate(
                LEG_SANDHI,
                "inconsistent-enumeration",
                f"一 pinned surface yi4 but following tone is {next_tone} (yì applies before tones 1/2/3)",
            )
    if b_tone != s_tone:
        unit.shift_applied = True


def run(units: list[Unit], tables: Tables) -> set[int]:
    """Resolve surfaces; return the sandhi spans as a set of unit indexes
    (consumed by leg (e): vote disagreement intersecting a span regenerates)."""
    spans: set[int] = set()

    # Group displayable Han units by run.
    runs: dict[int, list[int]] = {}
    for i, unit in enumerate(units):
        if unit.run_id >= 0 and unit.kind in ("word", "single") and unit.band != "RED":
            runs.setdefault(unit.run_id, []).append(i)

    for run_units in runs.values():
        # Flat syllable stream: (unit_index, syllable_index).
        stream: list[tuple[int, int]] = [
            (ui, si) for ui in run_units for si in range(len(units[ui].base))
        ]

        # 不/一 shift consistency (shifts applied only per the enumeration).
        for pos, (ui, si) in enumerate(stream):
            unit = units[ui]
            if unit.kind == "single" and unit.surface in ("不", "一"):
                nxt = stream[pos + 1] if pos + 1 < len(stream) else None
                next_tone = tone_of(units[nxt[0]].base[nxt[1]]) if nxt else None
                _consistency_check(units, ui, next_tone)

        # Third-tone runs over BASE tones.
        pos = 0
        while pos < len(stream):
            if tone_of(units[stream[pos][0]].base[stream[pos][1]]) != 3:
                pos += 1
                continue
            end = pos
            while (
                end + 1 < len(stream)
                and tone_of(units[stream[end + 1][0]].base[stream[end + 1][1]]) == 3
            ):
                end += 1
            length = end - pos + 1
            involved = [stream[k][0] for k in range(pos, end + 1)]
            distinct = sorted(set(involved))
            if length >= 3 and len(distinct) > 1:
                raise Regenerate(
                    LEG_SANDHI,
                    "crossword-third-tone-run",
                    f"{length}-syllable third-tone run spans {len(distinct)} words "
                    f"({''.join(units[ui].surface for ui in distinct)}) — grouping is "
                    "not deterministic; regenerating (conservative-by-construction)",
                )
            if length >= 3:
                # Within one word: the grouping must be curated — the curated
                # surface may not still stack adjacent third tones.
                unit = units[distinct[0]]
                surface_tones = [tone_of(s) for s in unit.surface_py]
                if any(a == 3 and b == 3 for a, b in zip(surface_tones, surface_tones[1:])):
                    raise Regenerate(
                        LEG_SANDHI,
                        "uncurated-within-word-run",
                        f"{unit.surface}: {length}-syllable within-word third-tone run "
                        "has no curated grouping in surfacePinyin — regenerating",
                    )
                spans.update(distinct)
                unit.shift_applied = True
            elif length == 2:
                # Deterministic pairwise 3-3 → 2-3 (no grouping ambiguity).
                first_ui, first_si = stream[pos]
                first = units[first_ui]
                if tone_of(first.surface_py[first_si]) == 3:
                    first.surface_py[first_si] = with_tone(first.surface_py[first_si], 2)
                first.shift_applied = True
                spans.update(distinct)
            pos = end + 1

    for i, unit in enumerate(units):
        if unit.kind in ("word", "single") and unit.band != "RED":
            if unit.shift_applied:
                spans.add(i)
                unit.add_evidence(
                    LEG_SANDHI,
                    True,
                    f"surface {' '.join(unit.surface_py)} (shift applied per curated enumeration/rule)",
                )
            else:
                unit.add_evidence(LEG_SANDHI, True)
    return spans
