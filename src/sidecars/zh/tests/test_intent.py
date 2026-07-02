"""Leg (g) — intent cross-check unit tests (bidirectional, fail-closed)."""

from __future__ import annotations

import pytest

from app.legs import Regenerate, intent
from app.legs.cover import segment


def _units(text: str, tables):
    return segment(text, tables)


def _intents(*ids: str) -> list[dict]:
    return [{"id": i, "description": i} for i in ids]


def test_bidirectional_coverage_passes(tables):
    units = _units("我喝茶", tables)
    intent.run(units, _intents("drink", "tea"))
    drink = next(u for u in units if u.surface == "喝")
    assert any(e["legId"] == "intent-cross-check" and e["pass"] for e in drink.evidence)


def test_unrealized_intent_regenerates(tables):
    units = _units("我喝茶", tables)
    with pytest.raises(Regenerate) as exc:
        intent.run(units, _intents("drink", "tea", "coffee"))
    assert exc.value.reason == "intent-mismatch"
    assert "coffee" in exc.value.detail


def test_uncovered_sense_regenerates(tables):
    units = _units("我喝茶", tables)
    with pytest.raises(Regenerate) as exc:
        intent.run(units, _intents("drink"))  # 茶's sense 'tea' is uncovered
    assert exc.value.reason == "intent-mismatch"
    assert "茶" in exc.value.detail


def test_structural_tokens_are_exempt(tables):
    # 兩/個 are structural (numeral/classifier): they neither need coverage
    # nor satisfy an intent; an empty intent list is a valid, covered turn.
    units = _units("兩個", tables)
    intent.run(units, [])


def test_direction_one_skipped_when_red_present(tables):
    # 你喝咖啡嗎: the whole run is RED (out-of-world) — whether the withheld
    # span realized 'drink' is unknowable, so the unrealized-intent half is
    # skipped and the per-token RED verdict is returned instead.
    units = _units("你喝咖啡嗎", tables)
    assert any(u.band == "RED" for u in units)
    intent.run(units, _intents("drink"))  # must NOT raise


def test_direction_two_still_runs_with_red_present(tables):
    # A displayable token with an uncovered sense never displays, RED
    # elsewhere or not.
    units = _units("茶�", tables)
    with pytest.raises(Regenerate):
        intent.run(units, _intents())
