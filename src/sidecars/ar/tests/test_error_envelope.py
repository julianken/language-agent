"""Error responses must ride the contract's Error envelope, not FastAPI's
default `{"detail": …}` shape."""

from __future__ import annotations


def _assert_error_envelope(body: dict) -> None:
    assert set(body.keys()) == {"code", "message"}
    assert isinstance(body["code"], str) and body["code"]
    assert isinstance(body["message"], str) and body["message"]


def test_unparseable_body_is_400(client) -> None:
    response = client.post(
        "/v1/verify", content=b"{not json", headers={"content-type": "application/json"}
    )
    assert response.status_code == 400
    body = response.json()
    _assert_error_envelope(body)
    assert body["code"] == "MALFORMED_BODY"


def test_undecodable_body_is_400(client) -> None:
    # Invalid UTF-8 short-circuits before request validation as a bare
    # HTTPException inside FastAPI — it must still ride the Error envelope
    # (regression: found by the Schemathesis fuzz, seed 7).
    response = client.post(
        "/v1/verify", content=b"\xff9\xfe", headers={"content-type": "application/json"}
    )
    assert response.status_code == 400
    body = response.json()
    _assert_error_envelope(body)
    assert body["code"] == "MALFORMED_BODY"


def test_unknown_field_is_422(client) -> None:
    # The request schema is closed (additionalProperties: false).
    response = client.post(
        "/v1/verify", json={"targetText": "كتب", "intents": [], "unknownField": 1}
    )
    assert response.status_code == 422
    _assert_error_envelope(response.json())


def test_missing_required_field_is_422(client) -> None:
    response = client.post("/v1/verify", json={"intents": []})
    assert response.status_code == 422
    _assert_error_envelope(response.json())


def test_wrong_intent_shape_is_422(client) -> None:
    response = client.post(
        "/v1/verify", json={"targetText": "كتب", "intents": [{"id": "i1"}]}
    )
    assert response.status_code == 422
    _assert_error_envelope(response.json())
