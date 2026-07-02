"""Leg (c) — C3 context-pinned head-set lookup unit tests (fail-closed)."""

from __future__ import annotations

import dataclasses

import pytest

from app.legs import Regenerate
from app.legs import headset
from app.legs.cover import segment


def _run_headset(text: str, tables):
    units = segment(text, tables)
    headset.run(units, tables)
    return units


def test_enumerated_context_resolves(tables):
    units = _run_headset("我的茶", tables)
    de = units[1]
    assert de.kind == "single"
    assert de.base == ["de5"] and de.surface_py == ["de5"]


def test_unenumerated_context_fails_closed(tables):
    with pytest.raises(Regenerate) as exc:
        _run_headset("你的茶", tables)
    assert exc.value.leg_id == "headset-context-pinned"
    assert exc.value.reason == "unenumerated-context"


def test_c3_admitted_single_without_any_entry_fails_closed(tables):
    # 呢 is C3-admitted (a pinned single in the cover lattice) but the stub
    # enumerates no context for it — every occurrence must regenerate.
    assert "呢" in tables.singles
    with pytest.raises(Regenerate) as exc:
        _run_headset("茶呢", tables)
    assert exc.value.reason == "unenumerated-context"


def test_hard_pattern_potential_infix(tables):
    with pytest.raises(Regenerate) as exc:
        _run_headset("喝不了", tables)
    assert exc.value.leg_id == "headset-context-pinned"
    assert exc.value.reason == "potential-infix"


def test_hard_pattern_ordinal_requires_enumerated_rule(tables):
    # Enumerated: 星期一 carries the ordinal-date rule and stays yī.
    units = _run_headset("星期一", tables)
    yi = units[1]
    assert yi.base == ["yi1"] and yi.surface_py == ["yi1"]
    assert yi.entry is not None and yi.entry.get("rule") == "ordinal-date"

    # Same text WITHOUT the enumerated ordinal entry → the hard-coded
    # pattern regenerates even before the generic fail-closed default.
    context = dict(tables.context)
    del context[("一", "星期", "<END>")]
    patched = dataclasses.replace(tables, context=context)
    with pytest.raises(Regenerate) as exc:
        _run_headset("星期一", patched)
    assert exc.value.reason == "ordinal-unenumerated"


def test_ordinal_entry_without_rule_marker_fails_closed(tables):
    context = dict(tables.context)
    entry = dict(context[("一", "星期", "<END>")])
    entry.pop("rule")
    context[("一", "星期", "<END>")] = entry
    patched = dataclasses.replace(tables, context=context)
    with pytest.raises(Regenerate) as exc:
        _run_headset("星期一", patched)
    assert exc.value.reason == "ordinal-unenumerated"


def test_pinned_base_reading_is_membership_rechecked(tables):
    context = dict(tables.context)
    entry = dict(context[("的", "我", "茶")])
    entry["base"] = "da4"  # not a candidate reading of 的
    context[("的", "我", "茶")] = entry
    patched = dataclasses.replace(tables, context=context)
    units = _run_headset("我的茶", patched)
    de = units[1]
    assert de.band == "RED" and de.red_reason == "membership-miss"
