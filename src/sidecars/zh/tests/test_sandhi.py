"""Leg (d) — sandhi resolver + conservative third-tone grouping unit tests."""

from __future__ import annotations

import dataclasses

import pytest

from app.legs import Regenerate, headset, sandhi
from app.legs.cover import segment


def _prepare(text: str, tables):
    units = segment(text, tables)
    headset.run(units, tables)
    return units


def test_crossword_three_run_regenerates(tables):
    units = _prepare("你想好", tables)
    with pytest.raises(Regenerate) as exc:
        sandhi.run(units, tables)
    assert exc.value.leg_id == "sandhi-resolver"
    assert exc.value.reason == "crossword-third-tone-run"


def test_within_word_curated_run_is_green_with_curated_surface(tables):
    units = _prepare("展覽館", tables)
    spans = sandhi.run(units, tables)
    unit = units[0]
    assert unit.band == "GREEN"
    assert unit.surface_py == ["zhan2", "lan2", "guan3"]  # the curated grouping
    assert 0 in spans  # counts as a sandhi span for the vote-intersect rule


def test_uncurated_within_word_run_fails_closed(tables):
    words = dict(tables.words)
    words["展覽館"] = {**words["展覽館"], "surfacePinyin": ["zhan3", "lan3", "guan3"]}
    patched = dataclasses.replace(tables, words=words)
    units = _prepare("展覽館", patched)
    with pytest.raises(Regenerate) as exc:
        sandhi.run(units, patched)
    assert exc.value.reason == "uncurated-within-word-run"


def test_crossword_two_run_shift_is_deterministic(tables):
    # 好|好: a 2-syllable third-tone run across two words — deterministic
    # pairwise 3-3 → 2-3, both units marked as a sandhi span. (Over HTTP this
    # exact text then regenerates at the VOTE leg — jieba merges 好好 — which
    # is the 19-regen-vote-sandhi-intersect golden fixture; this test pins
    # the resolver half in isolation.)
    units = _prepare("好好", tables)
    spans = sandhi.run(units, tables)
    assert units[0].surface_py == ["hao2"]
    assert units[1].surface_py == ["hao3"]
    assert spans == {0, 1}


def test_no_shift_on_isolated_third_tone(tables):
    units = _prepare("我的茶", tables)
    spans = sandhi.run(units, tables)
    assert units[0].surface_py == ["wo3"]
    assert spans == set()


def test_inconsistent_enumeration_fails_closed(tables):
    # A (test-only) context entry pinning 一 → yí before a NON-4th tone is an
    # inconsistent enumeration; the resolver's applicability rules refuse it.
    context = dict(tables.context)
    context[("一", "<START>", "好")] = {
        "char": "一",
        "prev": "<START>",
        "next": "好",
        "base": "yi1",
        "surface": "yi2",
        "rule": "tone-shift-before-4",
    }
    patched = dataclasses.replace(tables, context=context)
    units = _prepare("一好", patched)
    with pytest.raises(Regenerate) as exc:
        sandhi.run(units, patched)
    assert exc.value.reason == "inconsistent-enumeration"
