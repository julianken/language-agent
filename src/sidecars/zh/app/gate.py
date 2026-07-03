"""The gate: composes the legs in the issue #19 order and mints the
shared-contract token stream.

Order (load-bearing): (a) exact-cover segmentation → (b) citation-membership
→ (c) C3 context-pinned lookup → (d) sandhi resolver + third-tone grouping →
(e) normalized jieba vote → (f) 兩/二 numeral rule → (g) intent cross-check.

Two failure shapes, both fail-closed:

- TOKEN-level RED (out-of-world run, corrupt byte, membership miss): the
  token bands RED in place; the rest of the stream keeps its own verdicts
  (the engine repairs the RED span — design §6.5, the scoped RED law).
- CANDIDATE-level regenerate (>1 cover, unenumerated context, hard-coded
  patterns, cross-word third-tone run, vote∩sandhi, numeral rule, intent
  mismatch): the response collapses to a single RED token of kind
  ``candidate`` spanning the whole text, with
  ``annotations.payload.action == "regenerate-candidate"`` — the gate refuses
  to mint boundaries for a candidate that must not display; the engine
  regenerates. (The wire has no top-level verdict field by design — the band
  vocabulary is closed and RED already means "refused, repair engine-side".)
"""

from __future__ import annotations

import unicodedata

from generated.models import VerifyRequest, VerifyResponse

from .legs import BAND_RED, Regenerate, Unit
from .legs import cover as _cover
from .legs import headset, intent, membership, numeral, sandhi, vote
from .pinyin import display
from .state import Tables

LANGUAGE = "zh"
ANNOTATION_SCHEMA_ID = "zh-annotations/v1"


class VerifyGate:
    def __init__(self, tables: Tables, voter) -> None:
        self.tables = tables
        self.voter = voter

    def verify(self, request: VerifyRequest) -> VerifyResponse:
        text = unicodedata.normalize("NFC", request.targetText)
        intents = [{"id": i.id, "description": i.description} for i in request.intents]
        try:
            units = _cover.segment(text, self.tables)
            membership.run(units, self.tables)
            headset.run(units, self.tables)
            spans = sandhi.run(units, self.tables)
            vote.run(units, self.tables, self.voter, spans)
            numeral.run(units, self.tables)
            intent.run(units, intents)
        except Regenerate as regen:
            return self._regenerate_response(text, regen)
        return self._stream_response(units)

    # -- response minting ---------------------------------------------------

    def _regenerate_response(self, text: str, regen: Regenerate) -> VerifyResponse:
        token = {
            "spine": {
                "id": "t1",
                "lang": LANGUAGE,
                "surface": text,
                "kind": "candidate",
                "status": "new",
                "band": BAND_RED,
            },
            "band": BAND_RED,
            "evidence": [
                {"legId": regen.leg_id, "pass": False, "detail": regen.detail}
            ],
            "annotations": {
                "lang": LANGUAGE,
                "schemaId": ANNOTATION_SCHEMA_ID,
                "payload": {
                    "action": "regenerate-candidate",
                    "reason": regen.reason,
                    "legId": regen.leg_id,
                },
            },
        }
        return VerifyResponse.model_validate({"tokens": [token]})

    def _stream_response(self, units: list[Unit]) -> VerifyResponse:
        tokens = []
        for n, unit in enumerate(units, start=1):
            tokens.append(
                {
                    "spine": {
                        "id": f"t{n}",
                        "lang": LANGUAGE,
                        "surface": unit.surface,
                        "kind": unit.kind,
                        "status": "new",
                        "band": unit.band,
                    },
                    "band": unit.band,
                    "evidence": unit.evidence,
                    "annotations": {
                        "lang": LANGUAGE,
                        "schemaId": ANNOTATION_SCHEMA_ID,
                        "payload": self._payload(unit),
                    },
                }
            )
        return VerifyResponse.model_validate({"tokens": tokens})

    def _payload(self, unit: Unit) -> dict:
        if unit.band == BAND_RED:
            return {"reason": unit.red_reason}
        if unit.kind == "word" and unit.lex is not None:
            return {
                "readingId": unit.lex["readingId"],
                "citationPinyin": [display(s) for s in unit.base],
                "surfacePinyin": [display(s) for s in unit.surface_py],
                "pos": unit.lex["pos"],
                "senseId": unit.lex["senseId"],
                "gloss": unit.lex["gloss"],
            }
        if unit.kind == "single" and unit.entry is not None:
            payload = {
                "citationPinyin": [display(s) for s in unit.base],
                "surfacePinyin": [display(s) for s in unit.surface_py],
                "contextKey": f"{unit.entry['prev']}|{unit.entry['char']}|{unit.entry['next']}",
            }
            if unit.entry.get("rule"):
                payload["rule"] = unit.entry["rule"]
            return payload
        return {}
