"""Endpoint-discipline tests: honest readiness, static capabilities, the
error envelope, and the contract-version mirror."""

from __future__ import annotations

import re
from pathlib import Path

from fastapi.testclient import TestClient

from generated.models import Capabilities, Error, HealthResponse, ReadinessReport

from app.main import CONTRACT_VERSION, create_app

SIDECAR_ROOT = Path(__file__).resolve().parent.parent
SHARED_SPEC = (
    SIDECAR_ROOT.parent.parent / "packages" / "contract" / "sidecar" / "openapi.yaml"
)


def test_readyz_is_honest_and_healthz_is_cheap():
    # No auto-warmup: the app is up but no table is loaded.
    app = create_app(auto_warmup=False)
    with TestClient(app) as client:
        # Liveness answers from the HTTP layer alone — no tables needed.
        health = client.get("/healthz")
        assert health.status_code == 200
        HealthResponse.model_validate(health.json())

        ready = client.get("/readyz")
        assert ready.status_code == 503
        report = ReadinessReport.model_validate(ready.json())
        assert report.ready is False
        assert {c.id for c in report.checks} == {
            "sliver-lexicon",
            "cedict-extract",
            "unihan-kmandarin",
            "c9-context-table",
            "segmenter-voter",
        }
        assert all(c.ready is False for c in report.checks)

        # Load synchronously; only now may /readyz say 200.
        app.state.sidecar.warmup()
        ready = client.get("/readyz")
        assert ready.status_code == 200
        report = ReadinessReport.model_validate(ready.json())
        assert report.ready is True and all(c.ready for c in report.checks)


def test_capabilities_exact_declaration(client):
    response = client.get("/v1/capabilities")
    assert response.status_code == 200
    caps = Capabilities.model_validate(response.json())
    assert caps.language == "zh"
    assert caps.contractVersion == CONTRACT_VERSION
    # Issue #19 AC: EXACTLY this list.
    assert caps.verificationLegs == [
        "cedict-unihan-membership",
        "seed-closed-world",
        "headset-context-pinned",
        "sandhi-resolver",
        "segmenter-vote",
        "numeral-rule",
    ]
    assert caps.annotationSchemaId == "zh-annotations/v1"
    assert caps.features == []


def test_contract_version_mirrors_shared_spec():
    spec = SHARED_SPEC.read_text("utf-8")
    m = re.search(r"^  version: (\d+\.\d+\.\d+)$", spec, re.MULTILINE)
    assert m, "shared spec must carry a plain MAJOR.MINOR.PATCH info.version"
    assert CONTRACT_VERSION == m.group(1)


def test_error_envelope_400_for_malformed_json(client):
    response = client.post(
        "/v1/verify",
        content=b"{not json",
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 400
    err = Error.model_validate(response.json())
    assert err.code == "malformed-request"


def test_error_envelope_400_for_invalid_utf8_body(client):
    # FastAPI's own body-parsing failure (invalid UTF-8) must also ride the
    # contract's Error envelope, not the default {"detail": ...} shape
    # (found by the Schemathesis fuzz run).
    response = client.post(
        "/v1/verify",
        content=b"\xc3\x28",
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 400
    err = Error.model_validate(response.json())
    assert err.code == "malformed-request"


def test_error_envelope_422_for_semantic_invalidity(client):
    for payload in (
        {"targetText": 5, "intents": []},  # wrong type
        {"targetText": "x", "intents": [], "extra": 1},  # closed object
        {"intents": []},  # missing required
    ):
        response = client.post("/v1/verify", json=payload)
        assert response.status_code == 422
        err = Error.model_validate(response.json())
        assert err.code == "invalid-request"
