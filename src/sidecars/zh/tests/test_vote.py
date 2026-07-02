"""Leg (e) — normalized jieba vote unit tests."""

from __future__ import annotations

import pytest

from app.legs import Regenerate, headset, sandhi, vote
from app.legs.cover import segment
from app.legs.vote import normalize_cut


def _through_vote(text: str, tables, voter):
    units = segment(text, tables)
    headset.run(units, tables)
    spans = sandhi.run(units, tables)
    vote.run(units, tables, voter, spans)
    return units


def test_normalization_maps_convention_differences_to_agreement(tables, voter):
    # jieba cuts 你喝茶嗎 as 你|喝茶|嗎 (its dictionary knows 喝茶); the
    # stub normalization maps 喝茶 → 喝|茶 (the pinned AS-standard cut), so
    # the vote counts as agreement, not disagreement.
    units = _through_vote("你喝茶嗎", tables, voter)
    assert all(u.band == "GREEN" for u in units)
    assert normalize_cut(["你", "喝茶", "嗎"], tables.normalization) == [
        "你",
        "喝",
        "茶",
        "嗎",
    ]


def test_genuine_disagreement_downgrades_to_yellow(tables, voter):
    # jieba merges 好喝; no normalization mapping exists → post-normalization
    # disagreement → YELLOW (scaffolds pinned), not RED.
    units = _through_vote("好喝", tables, voter)
    assert [u.band for u in units] == ["YELLOW", "YELLOW"]
    details = [e for u in units for e in u.evidence if e["legId"] == "segmenter-vote"]
    assert all(e["pass"] is False for e in details)


def test_disagreement_intersecting_sandhi_span_regenerates(tables, voter):
    # 好好: cross-word 2-run third-tone shift (a sandhi span) + jieba merges
    # 好好 → the disagreement intersects the span → fail-closed.
    with pytest.raises(Regenerate) as exc:
        _through_vote("好好", tables, voter)
    assert exc.value.leg_id == "segmenter-vote"
    assert exc.value.reason == "vote-sandhi-intersect"


def test_injected_voter_disagreement(tables):
    # A synthetic voter that merges 我的 (no normalization entry) — proves
    # the leg logic independently of jieba's dictionary contents.
    def merged_voter(text: str) -> list[str]:
        return [text[:2], text[2:]] if len(text) > 2 else [text]

    units = _through_vote("我的茶", tables, merged_voter)
    assert [u.band for u in units] == ["YELLOW", "YELLOW", "GREEN"]


def test_red_tokens_are_excluded_from_the_vote(tables, voter):
    # The corrupt byte splits the runs; the remaining units vote normally.
    units = _through_vote("你喝�茶", tables, voter)
    assert [u.band for u in units] == ["GREEN", "GREEN", "RED", "GREEN"]
