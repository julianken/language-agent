"""Golden HTTP fixtures (issue #19 ACs) — the shared-contract token-stream
shape, run over the wire.

Every response is round-tripped through the GENERATED Pydantic models
(src/sidecars/zh/generated/models.py, regenerated from the shared spec), so
each golden case is also a schema-conformance check; the full property-fuzz
conformance run (Schemathesis against the built image, from the UNCHANGED
shared document) lives in CI.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from generated.models import VerifyResponse

GOLDEN_DIR = Path(__file__).parent / "fixtures" / "golden"
FIXTURES = sorted(GOLDEN_DIR.glob("*.json"))


def _no_nulls(obj) -> bool:
    if obj is None:
        return False
    if isinstance(obj, dict):
        return all(_no_nulls(v) for v in obj.values())
    if isinstance(obj, list):
        return all(_no_nulls(v) for v in obj)
    return True


@pytest.mark.parametrize("path", FIXTURES, ids=[p.stem for p in FIXTURES])
def test_golden(path: Path, client, poisoned_client):
    fixture = json.loads(path.read_text("utf-8"))
    http = poisoned_client if fixture["data"] == "poisoned-wrong-reading" else client

    response = http.post("/v1/verify", json=fixture["request"])
    assert response.status_code == 200
    body = response.json()

    # Schema conformance: the generated models are the contract.
    parsed = VerifyResponse.model_validate(body)

    # No nulls on the wire: optional-absent fields (spanGroup, detail) must
    # be OMITTED, not null — `additionalProperties: false` + non-nullable
    # types in the shared spec.
    assert _no_nulls(body), f"null value leaked into the response: {body}"

    # spine.band always equals the enclosing token band; ids unique.
    for token in body["tokens"]:
        assert token["spine"]["band"] == token["band"]
    ids = [t["spine"]["id"] for t in body["tokens"]]
    assert len(ids) == len(set(ids))

    expect = fixture["expect"]
    if expect["mode"] == "regenerate":
        assert len(parsed.tokens) == 1, "regenerate collapses to a single candidate token"
        token = body["tokens"][0]
        assert token["band"] == "RED"
        assert token["spine"]["kind"] == "candidate"
        assert token["spine"]["surface"] == fixture["request"]["targetText"]
        assert token["evidence"][0]["legId"] == expect["legId"]
        assert token["evidence"][0]["pass"] is False
        payload = token["annotations"]["payload"]
        assert payload["action"] == "regenerate-candidate"
        assert payload["reason"] == expect["reason"]
        return

    assert expect["mode"] == "stream"
    tokens = body["tokens"]
    assert [t["spine"]["surface"] for t in tokens] == [
        t["surface"] for t in expect["tokens"]
    ]
    for got, want in zip(tokens, expect["tokens"]):
        surface = want["surface"]
        assert got["band"] == want["band"], f"{surface}: band"
        assert got["spine"]["kind"] == want["kind"], f"{surface}: kind"
        payload = got["annotations"]["payload"]
        if "surfacePinyin" in want:
            assert payload["surfacePinyin"] == want["surfacePinyin"], f"{surface}: surface pinyin"
        if "redReason" in want:
            assert payload["reason"] == want["redReason"], f"{surface}: RED reason"
        assert got["annotations"]["schemaId"] == "zh-annotations/v1"
        assert got["annotations"]["lang"] == "zh"
