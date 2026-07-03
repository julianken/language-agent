"""/healthz and /readyz — cheap liveness vs honest readiness."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_healthz_is_live_without_any_model_state() -> None:
    """Liveness must answer from the HTTP layer alone (shared spec): a bare
    app with NO lifespan run — so no analyzer, no warmup thread — still
    serves /healthz."""
    from app.main import app

    response = TestClient(app).get("/healthz")  # no context manager: lifespan never runs
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readiness_report_is_honest_before_load() -> None:
    from app.main import AppState, READY_CHECK_ID, readiness_report

    report = readiness_report(AppState())
    assert report.ready is False
    assert report.checks[0].id == READY_CHECK_ID
    assert report.checks[0].ready is False
    assert report.checks[0].detail == "still loading"


def test_readiness_report_is_honest_after_failed_load() -> None:
    from app.main import AppState, readiness_report

    state = AppState()
    state.load_error = "RuntimeError: boom"
    state.ready_event.set()
    report = readiness_report(state)
    assert report.ready is False  # a failed load NEVER reports ready
    assert report.checks[0].detail == "RuntimeError: boom"


def test_readyz_200_once_db_loaded(client) -> None:
    response = client.get("/readyz")
    assert response.status_code == 200
    body = response.json()
    assert body["ready"] is True
    assert body["checks"][0]["id"] == "morphology-db-calima-msa-r13"
    assert body["checks"][0]["ready"] is True
    assert body["checks"][0]["detail"].startswith("loaded in ")
