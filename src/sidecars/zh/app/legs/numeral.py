"""Leg (f) — the 兩/二 numeral rule (legId ``numeral-rule``).

Number→character generation emits wrong-but-real characters, so numerals get
their OWN verification rule (design §6.8): 兩 before measure words and
hundreds, 二 for digits/ordinals. A violation is a generation defect →
candidate-level regenerate (fail-closed; never display, never band-only).
"""

from __future__ import annotations

from . import LEG_NUMERAL, Regenerate, Unit
from ..state import Tables


def run(units: list[Unit], tables: Tables) -> None:
    for i, unit in enumerate(units):
        if unit.band == "RED" or unit.kind != "word":
            continue
        if unit.lex is None or unit.lex["pos"] != "numeral":
            continue
        prev_u = units[i - 1] if i > 0 else None
        next_u = units[i + 1] if i + 1 < len(units) else None
        same_run_next = next_u is not None and next_u.run_id == unit.run_id
        same_run_prev = prev_u is not None and prev_u.run_id == unit.run_id

        if (
            unit.surface == "二"
            and same_run_next
            and next_u.kind == "word"
            and next_u.lex is not None
            and next_u.lex["pos"] == "classifier"
        ):
            raise Regenerate(
                LEG_NUMERAL,
                "er-before-classifier",
                f"二{next_u.surface}: quantity before a measure word must be 兩, "
                "not 二 — wrong-but-real numeral character; regenerating",
            )
        if unit.surface == "兩" and same_run_prev and prev_u.surface == "第":
            raise Regenerate(
                LEG_NUMERAL,
                "liang-in-ordinal",
                "第兩: ordinals take 二, not 兩 — regenerating",
            )
        unit.add_evidence(LEG_NUMERAL, True)
