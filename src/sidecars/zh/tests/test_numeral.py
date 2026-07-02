"""Leg (f) — 兩/二 numeral rule unit tests."""

from __future__ import annotations

import pytest

from app.legs import Regenerate, Unit, numeral
from app.legs.cover import segment


def test_er_before_classifier_regenerates(tables):
    units = segment("二個", tables)
    with pytest.raises(Regenerate) as exc:
        numeral.run(units, tables)
    assert exc.value.leg_id == "numeral-rule"
    assert exc.value.reason == "er-before-classifier"


def test_liang_before_classifier_passes(tables):
    units = segment("兩個", tables)
    numeral.run(units, tables)
    liang = units[0]
    assert {"legId": "numeral-rule", "pass": True} in liang.evidence


def test_liang_in_ordinal_position_regenerates(tables):
    # 第 is not in the closed world yet (it would RED at leg (a) over HTTP),
    # so the ordinal half of the rule is pinned with hand-built units — the
    # rule must already hold when curation admits 第.
    di = Unit(surface="第", kind="word", run_id=0, start=0)
    di.lex = {"pos": "prefix", "senseId": "ordinal", "intentBearing": False}
    liang = Unit(surface="兩", kind="word", run_id=0, start=1)
    liang.lex = tables.words["兩"]
    with pytest.raises(Regenerate) as exc:
        numeral.run([di, liang], tables)
    assert exc.value.reason == "liang-in-ordinal"


def test_er_in_isolation_passes(tables):
    units = segment("二", tables)
    numeral.run(units, tables)
    assert units[0].band == "GREEN"
