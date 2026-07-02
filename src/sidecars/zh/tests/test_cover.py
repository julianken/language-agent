"""Leg (a) — exact-cover segmentation unit tests."""

from __future__ import annotations

import pytest

from app.legs import Regenerate
from app.legs.cover import cover_run, scan, segment


def test_unique_cover_reconstruction(tables):
    assert cover_run("我喝茶", tables) == ["我", "喝", "茶"]
    assert cover_run("星期一", tables) == ["星期", "一"]
    assert cover_run("展覽館", tables) == ["展覽館"]


def test_ambiguous_cover_regenerates_instead_of_picking(tables):
    # 你好 covers as [你好] and [你|好] — the gate must refuse to choose.
    with pytest.raises(Regenerate) as exc:
        cover_run("你好", tables)
    assert exc.value.leg_id == "seed-closed-world"
    assert exc.value.reason == "ambiguous-cover"


def test_out_of_world_has_no_cover(tables):
    assert cover_run("咖啡", tables) is None  # real CC-CEDICT word, not in the sliver
    assert cover_run("喝咖啡", tables) is None  # partial coverage is not a cover


def test_scan_classification():
    assert scan("你喝 123。x") == [
        ("han", "你喝"),
        ("digit", "123"),
        ("punct", "。"),
        ("other", "x"),
    ]
    assert scan("  ") == []


def test_segment_reds_out_of_world_run_with_detail(tables):
    units = segment("你喝咖啡嗎", tables)
    assert len(units) == 1
    unit = units[0]
    assert unit.band == "RED" and unit.kind == "unverified"
    assert unit.red_reason == "out-of-world"
    assert "咖" in unit.evidence[0]["detail"] and "啡" in unit.evidence[0]["detail"]


def test_segment_reds_corrupt_byte_but_keeps_neighbours(tables):
    units = segment("你喝�茶", tables)
    surfaces = [(u.surface, u.band) for u in units]
    assert surfaces == [
        ("你", "GREEN"),
        ("喝", "GREEN"),
        ("�", "RED"),
        ("茶", "GREEN"),
    ]
    assert units[2].red_reason == "corrupt"


def test_digits_and_punct_are_closed_world(tables):
    units = segment("123。", tables)
    assert [(u.surface, u.kind, u.band) for u in units] == [
        ("123", "digit", "GREEN"),
        ("。", "punct", "GREEN"),
    ]
