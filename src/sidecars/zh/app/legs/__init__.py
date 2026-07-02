"""The deterministic verification legs, in the issue #19 order:

(a) closed-world exact-cover segmentation  → legId ``seed-closed-world``
(b) CC-CEDICT/Unihan citation-membership   → legId ``cedict-unihan-membership``
(c) C3 context-pinned head-set lookup      → legId ``headset-context-pinned``
(d) rule-based sandhi / 不-一 resolver      → legId ``sandhi-resolver``
(e) normalized jieba segmenter vote        → legId ``segmenter-vote``
(f) 兩/二 numeral rule                      → legId ``numeral-rule``
(g) intent cross-check                     → evidence id ``intent-cross-check``

(a)–(f) are the six legs `/v1/capabilities` declares. (g) is the port-1
contract obligation (`verify({targetText, intents})`) — implemented and
evidenced, but not a declared capability leg (the AC pins the exact
six-string list).

Candidate-level failures raise :class:`Regenerate`; the gate collapses the
response to a single RED token with ``action: regenerate-candidate`` in the
annotations payload (fail-closed — the engine must regenerate, nothing is
displayable). Token-level failures band the token RED in place.
"""

from __future__ import annotations

from dataclasses import dataclass, field

LEG_SEG = "seed-closed-world"
LEG_MEMBERSHIP = "cedict-unihan-membership"
LEG_HEADSET = "headset-context-pinned"
LEG_SANDHI = "sandhi-resolver"
LEG_VOTE = "segmenter-vote"
LEG_NUMERAL = "numeral-rule"
EVIDENCE_INTENT = "intent-cross-check"

# The exact declared capability list (issue #19 AC — order included).
CAPABILITY_LEGS = [
    LEG_MEMBERSHIP,
    LEG_SEG,
    LEG_HEADSET,
    LEG_SANDHI,
    LEG_VOTE,
    LEG_NUMERAL,
]

BAND_GREEN = "GREEN"
BAND_YELLOW = "YELLOW"
BAND_RED = "RED"


class Regenerate(Exception):
    """Candidate-level fail-closed verdict: regenerate, never display."""

    def __init__(self, leg_id: str, reason: str, detail: str) -> None:
        super().__init__(f"{leg_id}: {reason}: {detail}")
        self.leg_id = leg_id
        self.reason = reason
        self.detail = detail


@dataclass
class Unit:
    """One gate-internal token (the spine is minted from these at the end)."""

    surface: str
    kind: str  # word | single | punct | digit | unverified
    run_id: int  # Han-run index (-1 for non-Han tokens)
    start: int  # offset within the run (Han tokens only)
    band: str = BAND_GREEN
    red_reason: str | None = None
    evidence: list[dict] = field(default_factory=list)
    lex: dict | None = None  # lexicon tuple (kind == word)
    entry: dict | None = None  # context-table entry (kind == single)
    base: list[str] = field(default_factory=list)  # tone3 base readings
    surface_py: list[str] = field(default_factory=list)  # tone3 surface readings
    shift_applied: bool = False

    def add_evidence(self, leg_id: str, ok: bool, detail: str | None = None) -> None:
        item: dict = {"legId": leg_id, "pass": ok}
        if detail is not None:
            item["detail"] = detail
        self.evidence.append(item)

    def mark_red(self, reason: str) -> None:
        self.band = BAND_RED
        self.red_reason = reason
