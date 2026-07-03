"""Pinyin normalization utilities.

Internal canonical form is TONE-NUMBER pinyin ("tone3"): lowercase, `ü`
spelled `v` (pypinyin's tone3 canon — CC-CEDICT's `u:` and kMandarin's
diacritic both normalize to it), neutral tone as `5` (e.g. `hao3`, `de5`,
`lv4`). Every reading
that enters a comparison — CC-CEDICT syllables (`hao3`, `lu:4`), Unihan
kMandarin values (`hǎo`, `de`), pinned assets — is normalized through
`norm_syllable` first, so membership checks never fail on formatting.

Display form (what rides the `annotations` payload for the future ruby band)
is tone-MARK pinyin per the design's tuple schema (`chá`, neutral bare `de`).

pypinyin (MIT) provides the style conversion; all sandhi/tone-shift LOGIC is
in legs/sandhi.py — pypinyin's own `tone_sandhi` machinery is deliberately
unused (v0 shifts are applied only where the curated enumeration marks them
applicable, never computed blind).
"""

from __future__ import annotations

import unicodedata

from pypinyin.contrib.tone_convert import to_tone, to_tone3


def norm_syllable(syllable: str) -> str:
    """Normalize any pinyin syllable spelling to canonical tone3."""
    s = unicodedata.normalize("NFC", syllable.strip()).lower().replace("u:", "ü")
    return to_tone3(s, neutral_tone_with_five=True)


def display(syllable_tone3: str) -> str:
    """Canonical tone3 → tone-mark display form (neutral tone bare)."""
    return to_tone(syllable_tone3)


def tone_of(syllable_tone3: str) -> int:
    """The tone digit of a canonical tone3 syllable (neutral = 5)."""
    if syllable_tone3 and syllable_tone3[-1].isdigit():
        return int(syllable_tone3[-1])
    return 5


def with_tone(syllable_tone3: str, tone: int) -> str:
    """Return the syllable with its tone digit replaced."""
    base = syllable_tone3[:-1] if syllable_tone3 and syllable_tone3[-1].isdigit() else syllable_tone3
    return f"{base}{tone}"
