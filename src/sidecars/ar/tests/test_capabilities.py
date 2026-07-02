"""/v1/capabilities — the static declaration, and its lockstep guards."""

from __future__ import annotations

import json

import yaml


def test_capabilities_declaration(client) -> None:
    response = client.get("/v1/capabilities")
    assert response.status_code == 200
    assert response.json() == {
        "language": "ar",
        "contractVersion": "0.1.0",
        "verificationLegs": ["dediac-roundtrip", "camel-morph"],
        "annotationSchemaId": "ar-annotations/v1",
        "features": [],
    }


def test_contract_version_lockstep_with_shared_spec(client, openapi_path) -> None:
    """contractVersion must equal the hand-authored spec's info.version
    (exact equality — ADR §1.2/§3.5; in-tree packs deploy lockstep)."""
    spec = yaml.safe_load(openapi_path.read_text(encoding="utf-8"))
    declared = client.get("/v1/capabilities").json()["contractVersion"]
    assert declared == spec["info"]["version"]


def test_annotation_schema_id_lockstep_with_module_schema(client, ar_schema_path) -> None:
    """annotationSchemaId must equal the module-owned generated schema's $id
    (the zod schema in @la/lang-ar is the single canonical source)."""
    schema = json.loads(ar_schema_path.read_text(encoding="utf-8"))
    declared = client.get("/v1/capabilities").json()["annotationSchemaId"]
    assert declared == schema["$id"]
