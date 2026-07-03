"""Leg-1 unit tests — rule-based, no analyzer DB required."""

from __future__ import annotations

from app.dediac_leg import dediac_roundtrip


def test_clean_vocalized_form_passes() -> None:
    result = dediac_roundtrip("كَتَبَ")
    assert result.ok
    assert result.skeleton == "كتب"


def test_bare_skeleton_passes_leg1() -> None:
    # Vocalization completeness is leg 2's judgement; leg 1 only checks
    # structural integrity.
    result = dediac_roundtrip("كتب")
    assert result.ok
    assert result.skeleton == "كتب"


def test_diacritics_only_token_fails() -> None:
    result = dediac_roundtrip("َُ")
    assert not result.ok
    assert "no skeleton" in (result.detail or "")


def test_leading_orphan_mark_fails() -> None:
    result = dediac_roundtrip("َكتب")
    assert not result.ok
    assert "not attached" in (result.detail or "")


def test_stacked_vowel_marks_fail() -> None:
    result = dediac_roundtrip("كََتَبَ")
    assert not result.ok
    assert "stacked" in (result.detail or "")


def test_shadda_plus_vowel_is_legal() -> None:
    # e.g. كُتَّاب (kuttāb) — shadda + fatha stack on one letter legally.
    result = dediac_roundtrip("كُتَّاب")
    assert result.ok
    assert result.skeleton == "كتاب"


def test_mixed_arabic_latin_token_fails() -> None:
    result = dediac_roundtrip("كتبbook")
    assert not result.ok
    assert "mixed" in (result.detail or "")
