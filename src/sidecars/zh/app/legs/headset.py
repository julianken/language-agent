"""Leg (c) — the C3 context-pinned head-set lookup
(legId ``headset-context-pinned``).

The v0 sliver function-word subset (constraint C3, committed in issue #19
step 2(a): {的, 了, 不, 一} plus 嗎/呢 admitted as pinned singles) resolves
via `(char, role-context) → reading`, keyed on the curation-verified C9-style
enumeration. FAIL-CLOSED DEFAULT: any occurrence in a context outside the
verified enumeration → candidate-level regenerate — a guessed reading never
displays (issue #19 AC).

Two hard-coded fail-closed patterns fire REGARDLESS of what the enumeration
says (dual-instance amendment, Decision 1):

1. 不/得 immediately before 了 after a verb → regenerate (the §4.4-allowlisted
   potential infix composes V+不+了, where 了 reads liǎo, not the pinned le);
2. ordinal/date 一 (星期一, 一月, 第一 …) is resolved ONLY by an enumerated
   rule entry marked ``rule: ordinal-date`` — else regenerate.

This is DISTINCT from the full §6.8 hand-pinned head set (的/地/得, 了, 不,
一, 行, 重, 著, 和), which is NOT implemented in v0 — C3 is the
closed-world-reachable sliver subset owned by #20's curation.
"""

from __future__ import annotations

from . import LEG_HEADSET, LEG_MEMBERSHIP, Regenerate, Unit
from ..state import END, START, Tables
from .membership import reading_in_candidates

# Ordinal/date role markers (hard pattern 2). Only in-world neighbours can
# ever match, but the marker sets are written out in full so growing the
# closed world cannot silently un-guard a date position.
ORDINAL_PREV = {"星期", "週", "禮拜", "第"}
ORDINAL_NEXT = {"月", "日", "號"}


def _neighbours(units: list[Unit], i: int) -> tuple[str, str]:
    unit = units[i]
    prev_u = units[i - 1] if i > 0 else None
    next_u = units[i + 1] if i + 1 < len(units) else None
    prev = prev_u.surface if prev_u is not None and prev_u.run_id == unit.run_id else START
    nxt = next_u.surface if next_u is not None and next_u.run_id == unit.run_id else END
    return prev, nxt


def run(units: list[Unit], tables: Tables) -> None:
    for i, unit in enumerate(units):
        if unit.kind != "single" or unit.band == "RED":
            continue
        prev, nxt = _neighbours(units, i)
        prev_u = units[i - 1] if i > 0 else None

        # Hard pattern 1 — potential-infix hazard: V + 不/得 + 了.
        if unit.surface in ("不", "得") and nxt == "了":
            if (
                prev_u is not None
                and prev_u.kind == "word"
                and prev_u.lex is not None
                and prev_u.lex["pos"] == "verb"
                and prev_u.run_id == unit.run_id
            ):
                raise Regenerate(
                    LEG_HEADSET,
                    "potential-infix",
                    f"{prev}{unit.surface}了: V+{unit.surface}+了 potential construction — "
                    "了 reads liǎo here, not the pinned le (hard-coded fail-closed pattern)",
                )

        # Hard pattern 2 — ordinal/date 一 needs an enumerated ordinal rule.
        entry = tables.context.get((unit.surface, prev, nxt))
        if unit.surface == "一" and (prev in ORDINAL_PREV or nxt in ORDINAL_NEXT):
            if entry is None or entry.get("rule") != "ordinal-date":
                raise Regenerate(
                    LEG_HEADSET,
                    "ordinal-unenumerated",
                    f"一 in ordinal/date position ({prev}|一|{nxt}) with no enumerated "
                    "ordinal-date rule — regenerating (hard-coded fail-closed pattern)",
                )

        # Fail-closed default: unenumerated context → regenerate.
        if entry is None:
            raise Regenerate(
                LEG_HEADSET,
                "unenumerated-context",
                f"context {prev}|{unit.surface}|{nxt} is outside the verified C9-style "
                "enumeration — regenerating instead of displaying a guessed reading",
            )

        # Membership re-check of the context-pinned base reading (the leg-(b)
        # half deferred until the occurrence's pinned reading is known).
        if not reading_in_candidates(unit.surface, entry["base"], tables):
            unit.mark_red("membership-miss")
            unit.add_evidence(
                LEG_MEMBERSHIP,
                False,
                f"{unit.surface}: pinned base {entry['base']} not in membership candidate set",
            )
            continue
        unit.add_evidence(LEG_MEMBERSHIP, True)

        unit.entry = entry
        unit.base = [entry["base"]]
        unit.surface_py = [entry["surface"]]
        detail = f"context {prev}|{unit.surface}|{nxt} → {entry['base']}"
        if entry.get("rule"):
            detail += f" (rule: {entry['rule']})"
        unit.add_evidence(LEG_HEADSET, True, detail)
