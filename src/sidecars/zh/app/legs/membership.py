"""Leg (b) — CC-CEDICT + Unihan citation-membership re-check
(legId ``cedict-unihan-membership``).

The only path to a *reading-verdict* RED (design §6.1: the deterministic
floor). Checks CITATION pinyin only — never the surface form (a sandhi tone
like 你好 → ní hǎo is correct yet absent from every dictionary; design §3.4).

For each word token: after variant→MOE normalization + NFC, the word's
pinned citation reading must be contained in its CC-CEDICT (Traditional
field) reading set, AND each character's citation syllable must be in that
character's candidate set (Unihan kMandarin ∪ per-position CC-CEDICT
syllables). A miss bands the token RED — a wrongly-pinned tuple (or a
corrupted table) can never display.

For singles, the char must exist in the membership tables here; the pinned
reading's membership is re-checked in leg (c) once the context table has
resolved which reading is pinned for this occurrence.
"""

from __future__ import annotations

import unicodedata

from . import LEG_MEMBERSHIP, Unit
from ..state import Tables


def normalize_word(word: str, tables: Tables) -> str:
    """variant→MOE-canonical + NFC, applied before any table lookup."""
    word = unicodedata.normalize("NFC", word)
    return "".join(tables.variant_map.get(ch, ch) for ch in word)


def reading_in_candidates(char: str, syllable_tone3: str, tables: Tables) -> bool:
    return syllable_tone3 in tables.char_candidates.get(char, set())


def check_word(unit: Unit, tables: Tables) -> None:
    word = normalize_word(unit.surface, tables)
    citation = unit.base
    readings = tables.cedict.get(word, [])
    problems: list[str] = []
    if citation not in readings:
        problems.append(
            f"citation reading {' '.join(citation)} not in CC-CEDICT(Traditional) readings for {word}"
        )
    if len(citation) == len(word):
        for char, syl in zip(word, citation):
            if not reading_in_candidates(char, syl, tables):
                problems.append(
                    f"{char}: {syl} not in Unihan-kMandarin∪CC-CEDICT candidate set"
                )
    else:
        problems.append(
            f"citation reading has {len(citation)} syllables for {len(word)} characters"
        )
    if problems:
        unit.mark_red("membership-miss")
        unit.add_evidence(LEG_MEMBERSHIP, False, "; ".join(problems))
    else:
        unit.add_evidence(LEG_MEMBERSHIP, True)


def check_single_char(unit: Unit, tables: Tables) -> None:
    """Char-presence half for singles; the pinned-reading half runs in leg (c)."""
    char = normalize_word(unit.surface, tables)
    if char not in tables.char_candidates:
        unit.mark_red("membership-miss")
        unit.add_evidence(
            LEG_MEMBERSHIP, False, f"{char}: no membership-table entry"
        )


def run(units: list[Unit], tables: Tables) -> None:
    for unit in units:
        if unit.band == "RED":
            continue
        if unit.kind == "word":
            check_word(unit, tables)
        elif unit.kind == "single":
            check_single_char(unit, tables)
