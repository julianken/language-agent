"""Gate leg 1 — the dediac round-trip (rule-based, no data dependency).

docs/research/arabic-validation.md §6: the emitted vocalized form must
decompose cleanly into a consonantal skeleton + attached ḥarakāt and
reassemble to exactly the emitted form — this catches hallucinated /
dropped / transposed letters, orphan or stacked diacritics, and
half-Latin/half-Arabic tokens instantly, with no analyzer data. All
comparisons are NFC-aware (research risk #6): the gate normalizes the
whole candidate text once at entry (see gate.py) before this leg runs.

Only camel-tools *code* (charsets + dediac utilities) is used here — the
morphology DB is leg 2's dependency, so this leg is live even while the
analyzer is still warming.
"""

from __future__ import annotations

from dataclasses import dataclass

from camel_tools.utils.charsets import AR_DIAC_CHARSET, AR_LETTERS_CHARSET
from camel_tools.utils.dediac import dediac_ar

_SHADDA = "ّ"
_SUPERSCRIPT_ALEF = "ٰ"
# The vowel-slot marks: one per consonant slot at most (a second one is a
# stacked-mark corruption). Shadda and the superscript (dagger) alef stack
# WITH a vowel mark legally, so they are counted separately.
_VOWEL_MARKS = frozenset(AR_DIAC_CHARSET) - {_SHADDA, _SUPERSCRIPT_ALEF}


@dataclass(frozen=True)
class DediacResult:
    ok: bool
    skeleton: str
    detail: str | None = None


def _fail(skeleton: str, detail: str) -> DediacResult:
    return DediacResult(ok=False, skeleton=skeleton, detail=detail)


def dediac_roundtrip(token: str) -> DediacResult:
    """Run leg 1 on one NFC-normalized word token."""
    skeleton = dediac_ar(token)

    if not skeleton:
        return _fail(skeleton, "diacritics-only token: no skeleton survives dediacritization")

    # Idempotence: stripping again must be a no-op, or the "skeleton" still
    # carries marks the round-trip would silently drop.
    if dediac_ar(skeleton) != skeleton:
        return _fail(skeleton, "dediacritization is not idempotent for this token")

    # Round-trip proper: removing exactly the ḥarakāt char-set must yield
    # the same skeleton dediac_ar produced — i.e. skeleton + diacritics
    # reassemble to the emitted form with nothing else hiding in between.
    manual = "".join(c for c in token if c not in AR_DIAC_CHARSET)
    if manual != skeleton:
        return _fail(skeleton, "skeleton + diacritics do not reassemble to the emitted form")

    # Reject half-Latin/half-Arabic tokens (research §8 risk 3: never let a
    # spliced token through as a "word").
    has_arabic = any(c in AR_LETTERS_CHARSET for c in token)
    has_latin = any(c.isascii() and c.isalpha() for c in token)
    if has_arabic and has_latin:
        return _fail(skeleton, "mixed Arabic/Latin token")

    # Attachment scan: every diacritic must sit on an Arabic letter, with at
    # most one vowel mark (+ optional shadda / superscript alef) per slot.
    slot_open = False
    vowels_in_slot = 0
    shaddas_in_slot = 0
    for c in token:
        if c in AR_DIAC_CHARSET:
            if not slot_open:
                return _fail(skeleton, "diacritic not attached to an Arabic letter")
            if c == _SHADDA:
                shaddas_in_slot += 1
                if shaddas_in_slot > 1:
                    return _fail(skeleton, "doubled shadda on one letter")
            elif c in _VOWEL_MARKS:
                vowels_in_slot += 1
                if vowels_in_slot > 1:
                    return _fail(skeleton, "stacked vowel marks on one letter")
        else:
            slot_open = c in AR_LETTERS_CHARSET
            vowels_in_slot = 0
            shaddas_in_slot = 0

    return DediacResult(ok=True, skeleton=skeleton)
