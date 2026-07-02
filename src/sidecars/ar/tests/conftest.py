"""Shared fixtures.

The suite runs primarily INSIDE the built image (CI: `docker run --network
none … python -m pytest -q tests`) — that run IS the offline-at-runtime
assertion the issue's AC names. The shared contract artifacts live outside
the docker build context and are mounted read-only at /contract; running
in-repo (cd src/sidecars/ar with the dev deps installed) resolves them
relative to the repo tree instead.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest


def _contract_artifact(filename: str, env_var: str, repo_relative: str) -> Path:
    if os.environ.get(env_var):
        return Path(os.environ[env_var])
    mounted = Path("/contract") / filename
    if mounted.exists():
        return mounted
    return Path(__file__).resolve().parents[3] / repo_relative


@pytest.fixture(scope="session")
def openapi_path() -> Path:
    return _contract_artifact("openapi.yaml", "OPENAPI_PATH", "packages/contract/sidecar/openapi.yaml")


@pytest.fixture(scope="session")
def ar_schema_path() -> Path:
    return _contract_artifact(
        "ar-annotations.schema.json", "AR_SCHEMA_PATH", "packages/lang-ar/ar-annotations.schema.json"
    )


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient

    from app.main import app, state

    with TestClient(app) as test_client:
        # Entering the context starts the lifespan → analyzer load thread.
        assert state.ready_event.wait(timeout=180), "analyzer never became ready"
        assert state.analyzer is not None, f"analyzer load failed: {state.load_error}"
        yield test_client
