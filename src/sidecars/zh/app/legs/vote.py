"""Leg (e) — the normalized jieba segmenter vote (legId ``segmenter-vote``).

The voter's boundaries are first normalized/mapped to the pinned AS/CKIP
standard (design §6.7) via the curation-owned normalization table, so a vote
counts as disagreement only when the cut genuinely differs — not when jieba
merely follows its Mainland segmentation convention.

Post-normalization disagreement → YELLOW on the affected tokens (a contested
boundary still yields readable real words; the engine pins scaffolds).
EXCEPT: disagreement intersecting a sandhi span → candidate-level regenerate
(a contested boundary under an applied tone shift could change the surface
form itself — fail-closed).
"""

from __future__ import annotations

from typing import Callable

from . import BAND_YELLOW, LEG_VOTE, Regenerate, Unit
from ..state import Tables

Voter = Callable[[str], list[str]]


def _boundaries(pieces: list[str]) -> set[int]:
    bounds, offset = {0}, 0
    for piece in pieces:
        offset += len(piece)
        bounds.add(offset)
    return bounds


def normalize_cut(cut: list[str], normalization: dict[str, list[str]]) -> list[str]:
    normalized: list[str] = []
    for segment in cut:
        normalized.extend(normalization.get(segment, [segment]))
    return normalized


def run(units: list[Unit], tables: Tables, voter: Voter, sandhi_spans: set[int]) -> None:
    runs: dict[int, list[int]] = {}
    for i, unit in enumerate(units):
        if unit.run_id >= 0 and unit.kind in ("word", "single") and unit.band != "RED":
            runs.setdefault(unit.run_id, []).append(i)

    for run_id, run_units in runs.items():
        run_text = "".join(units[ui].surface for ui in run_units)
        voter_cut = normalize_cut(voter(run_text), tables.normalization)
        theirs = _boundaries(voter_cut)

        disagreeing: list[int] = []
        offset = 0
        for ui in run_units:
            unit = units[ui]
            start, end = offset, offset + len(unit.surface)
            offset = end
            reproduced = (
                start in theirs
                and end in theirs
                and not any(b in theirs for b in range(start + 1, end))
            )
            if not reproduced:
                disagreeing.append(ui)

        if not disagreeing:
            for ui in run_units:
                units[ui].add_evidence(LEG_VOTE, True)
            continue

        intersecting = sorted(set(disagreeing) & sandhi_spans)
        if intersecting:
            raise Regenerate(
                LEG_VOTE,
                "vote-sandhi-intersect",
                "post-normalization boundary disagreement intersects a sandhi span "
                f"({''.join(units[ui].surface for ui in intersecting)}) — a contested "
                "boundary under an applied tone shift is fail-closed",
            )
        for ui in run_units:
            unit = units[ui]
            if ui in disagreeing:
                unit.band = BAND_YELLOW
                unit.add_evidence(
                    LEG_VOTE,
                    False,
                    "post-normalization boundary disagreement (jieba voter cut "
                    f"{'|'.join(voter_cut)}) — degraded confidence, scaffolds pinned",
                )
            else:
                unit.add_evidence(LEG_VOTE, True)
