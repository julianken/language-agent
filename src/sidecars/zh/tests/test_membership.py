"""Leg (b) — CC-CEDICT/Unihan citation-membership unit tests."""

from __future__ import annotations

import dataclasses

from app.legs import Unit
from app.legs.membership import check_word, normalize_word, reading_in_candidates
from app.pinyin import norm_syllable


def _word_unit(surface: str, tables, citation=None) -> Unit:
    unit = Unit(surface=surface, kind="word", run_id=0, start=0)
    unit.lex = tables.words[surface]
    unit.base = list(citation or unit.lex["citationPinyin"])
    unit.surface_py = list(unit.lex["surfacePinyin"])
    return unit


def test_pinned_citation_passes(tables):
    unit = _word_unit("茶", tables)
    check_word(unit, tables)
    assert unit.band == "GREEN"
    assert {"legId": "cedict-unihan-membership", "pass": True} in unit.evidence


def test_wrong_pinned_reading_is_red(tables):
    # chā is not a CC-CEDICT reading of 茶 nor its kMandarin — the
    # deterministic floor catches a wrongly-pinned/corrupted tuple.
    unit = _word_unit("茶", tables, citation=["cha1"])
    check_word(unit, tables)
    assert unit.band == "RED"
    assert unit.red_reason == "membership-miss"


def test_multi_syllable_word_checks_every_char(tables):
    unit = _word_unit("展覽館", tables)
    check_word(unit, tables)
    assert unit.band == "GREEN"
    bad = _word_unit("展覽館", tables, citation=["zhan3", "lan3", "guan1"])
    check_word(bad, tables)
    assert bad.band == "RED"


def test_candidate_sets_union_kmandarin_and_cedict(tables):
    # kMandarin lists one predominant reading; CC-CEDICT widens the set.
    for syllable in ("de5", "di1", "di2", "di4"):
        assert reading_in_candidates("的", syllable, tables)
    assert not reading_in_candidates("的", "da4", tables)
    # kMandarin-normalization: 展 appears as 'Zhan3' (capitalized surname
    # row) in CC-CEDICT and 'zhǎn' in kMandarin — both normalize to zhan3.
    assert reading_in_candidates("展", "zhan3", tables)


def test_norm_syllable_canonicalizes():
    assert norm_syllable("Zhan3") == "zhan3"
    assert norm_syllable("hǎo") == "hao3"
    assert norm_syllable("de") == "de5"  # bare neutral → 5
    # ü unifies across source spellings: CC-CEDICT writes u:, kMandarin
    # writes the diacritic; pypinyin's tone3 canon spells it v.
    assert norm_syllable("lu:4") == "lv4"
    assert norm_syllable("lǜ") == "lv4"


def test_variant_map_applies_before_lookup(tables):
    patched = dataclasses.replace(tables, variant_map={"荼": "茶"})
    assert normalize_word("荼", patched) == "茶"
    assert normalize_word("茶", tables) == "茶"
