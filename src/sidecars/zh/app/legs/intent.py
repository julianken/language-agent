"""Leg (g) — the intent cross-check (evidence id ``intent-cross-check``).

The port-1 contract obligation: `verify({targetText, intents})`. Committed v0
semantics (issue #19 step 2(g), folded from the plan review): intent↔sense
BIDIRECTIONAL coverage, any mismatch → candidate-level regenerate
(fail-closed; v0-conservative — never display, never band-only).

The v0 coverage relation is deterministic equality: an intent covers a token
iff the token tuple's ``senseId`` equals the intent's ``id``. Structural
tokens (pronouns, numerals, classifiers, the C3 singles, punctuation,
digits) are grammatically licensed — they carry no communicative sense of
their own, so they neither need intent coverage nor satisfy an intent.

- Direction 1 (every declared intent maps to ≥1 gated token sense) is
  evaluated only when the stream carries NO RED token: a RED already forces
  engine-side repair of the candidate, and whether the withheld span realized
  the intent is unknowable — the per-token RED verdict is the more precise
  signal to return.
- Direction 2 (every displayable intent-bearing token's pinned sense is
  covered by a declared intent) always runs — an uncovered sense on a
  displayable token means the candidate says something the turn did not
  intend; that never displays.
"""

from __future__ import annotations

from . import BAND_RED, EVIDENCE_INTENT, Regenerate, Unit


def run(units: list[Unit], intents: list[dict]) -> None:
    intent_ids = {intent["id"] for intent in intents}
    has_red = any(u.band == BAND_RED for u in units)
    displayable_words = [
        u for u in units if u.kind == "word" and u.band != BAND_RED and u.lex is not None
    ]

    for unit in displayable_words:
        if unit.lex["intentBearing"] and unit.lex["senseId"] not in intent_ids:
            raise Regenerate(
                EVIDENCE_INTENT,
                "intent-mismatch",
                f"{unit.surface} carries sense {unit.lex['senseId']!r} not covered by any "
                "declared intent — the candidate says something the turn did not intend",
            )

    if not has_red:
        senses = {u.lex["senseId"] for u in displayable_words}
        for intent_id in sorted(intent_ids):
            if intent_id not in senses:
                raise Regenerate(
                    EVIDENCE_INTENT,
                    "intent-mismatch",
                    f"declared intent {intent_id!r} maps to no gated token sense in the "
                    "stream — the candidate fails to realize the turn's intent",
                )

    for unit in displayable_words:
        if unit.lex["intentBearing"]:
            unit.add_evidence(EVIDENCE_INTENT, True, f"sense {unit.lex['senseId']} covered")
