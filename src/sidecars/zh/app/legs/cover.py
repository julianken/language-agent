"""Leg (a) — closed-world exact-cover segmentation (legId ``seed-closed-world``).

The token universe is CLOSED: sliver lexicon words + the C3 pinned singles +
punctuation + digits. Each maximal Han run must have EXACTLY ONE cover by
closed-world units:

- 0 covers  → the run contains out-of-world byte(s) → the run bands RED
  (an unanalyzable token must band RED — never a silent pass);
- >1 covers → candidate-level REGENERATE (fail-closed: the gate refuses to
  silently pick one — issue #19 AC);
- 1 cover   → those units are the token boundaries (boundaries are gate
  OUTPUT, per the shared spec).

Anything that is neither Han, digit, punctuation nor whitespace (mojibake,
Latin, replacement chars…) is out-of-world by construction → RED.
"""

from __future__ import annotations

import unicodedata

from . import BAND_GREEN, LEG_SEG, Regenerate, Unit
from ..state import Tables

_PUNCT = set("。，、？！：；「」『』（）《》〈〉…—～·.,!?;:()[]{}\"'-")
_DIGITS = set("0123456789０１２３４５６７８９")


def _is_han(ch: str) -> bool:
    return "一" <= ch <= "鿿" or "㐀" <= ch <= "䶿"


def scan(text: str) -> list[tuple[str, str]]:
    """Split into (type, chunk) segments: han | digit | punct | other.
    Whitespace separates runs and emits nothing."""
    segments: list[tuple[str, str]] = []
    i = 0
    while i < len(text):
        ch = text[i]
        if ch.isspace():
            i += 1
            continue
        if _is_han(ch):
            j = i
            while j < len(text) and _is_han(text[j]):
                j += 1
            segments.append(("han", text[i:j]))
            i = j
        elif ch in _DIGITS:
            j = i
            while j < len(text) and text[j] in _DIGITS:
                j += 1
            segments.append(("digit", text[i:j]))
            i = j
        elif ch in _PUNCT:
            segments.append(("punct", ch))
            i += 1
        else:
            segments.append(("other", ch))
            i += 1
    return segments


def cover_run(run: str, tables: Tables) -> list[str] | None:
    """Exact-cover a Han run by closed-world units.

    Returns the unique cover as a list of unit surfaces, ``None`` when no
    cover exists, and raises :class:`Regenerate` when more than one cover
    exists (never silently pick one).
    """
    n = len(run)
    units = tables.units
    max_len = tables.max_unit_len
    # ways[i] = number of covers of run[:i], capped at 2 (2 == "many").
    ways = [0] * (n + 1)
    ways[0] = 1
    first_fit: list[tuple[int, str] | None] = [None] * (n + 1)
    for i in range(1, n + 1):
        for length in range(1, min(max_len, i) + 1):
            piece = run[i - length : i]
            if piece in units and ways[i - length]:
                if ways[i] == 0:
                    first_fit[i] = (i - length, piece)
                ways[i] = min(2, ways[i] + ways[i - length])
    if ways[n] == 0:
        return None
    if ways[n] > 1:
        raise Regenerate(
            LEG_SEG,
            "ambiguous-cover",
            f"more than one valid closed-world cover for {run!r} — regenerating instead of silently picking one",
        )
    cover: list[str] = []
    i = n
    while i > 0:
        prev, piece = first_fit[i]  # type: ignore[misc]
        cover.append(piece)
        i = prev
    cover.reverse()
    return cover


def segment(text: str, tables: Tables) -> list[Unit]:
    """Run leg (a) over the whole candidate text."""
    text = unicodedata.normalize("NFC", text)
    units: list[Unit] = []
    run_id = 0
    for seg_type, chunk in scan(text):
        if seg_type == "han":
            cover = cover_run(chunk, tables)
            if cover is None:
                oow = sorted({c for c in chunk if c not in tables.closed_chars})
                unit = Unit(surface=chunk, kind="unverified", run_id=run_id, start=0)
                unit.mark_red("out-of-world")
                unit.add_evidence(
                    LEG_SEG,
                    False,
                    "no closed-world cover"
                    + (f"; out-of-world characters: {' '.join(oow)}" if oow else ""),
                )
                units.append(unit)
            else:
                offset = 0
                for piece in cover:
                    kind = "single" if piece in tables.singles else "word"
                    unit = Unit(surface=piece, kind=kind, run_id=run_id, start=offset)
                    unit.band = BAND_GREEN
                    unit.add_evidence(LEG_SEG, True)
                    if kind == "word":
                        unit.lex = tables.words[piece]
                        unit.base = list(unit.lex["citationPinyin"])
                        unit.surface_py = list(unit.lex["surfacePinyin"])
                    units.append(unit)
                    offset += len(piece)
            run_id += 1
        elif seg_type in ("digit", "punct"):
            unit = Unit(surface=chunk, kind=seg_type, run_id=-1, start=0)
            unit.add_evidence(LEG_SEG, True)
            units.append(unit)
        else:  # other: not Han, not digit, not punctuation — unanalyzable
            unit = Unit(surface=chunk, kind="unverified", run_id=-1, start=0)
            unit.mark_red("corrupt")
            unit.add_evidence(
                LEG_SEG,
                False,
                f"unanalyzable byte(s) outside the closed world: {chunk!r}",
            )
            units.append(unit)
            run_id += 1  # a corrupt byte breaks any adjacent Han run pairing
    return units
