"""The Arabic verification sidecar — FastAPI app (issue #7 stage 2).

Every route types against the GENERATED Pydantic v2 models
(src/sidecars/ar/generated/models.py, regenerated from the hand-authored
shared spec src/packages/contract/sidecar/openapi.yaml) — the
implementation types AGAINST the contract, it never emits it. The app's
own /openapi.json is disabled outright for the same reason (ADR §3.2: an
implementation's emitted document must never become the spec).

Readiness is honest (ADR §3.3): /readyz answers 200 only once the
calima-msa-r13 DB is loaded and /v1/verify could serve immediately; the DB
loads on a background thread started at lifespan startup so /healthz is
live from the first instant without ever touching the model.
"""

from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import contractmeta as meta
from generated.models import (
    Capabilities,
    Error,
    HealthResponse,
    ReadinessCheck,
    ReadinessReport,
    VerifyRequest,
    VerifyResponse,
)

log = logging.getLogger("sidecar-ar")

READY_CHECK_ID = f"morphology-db-{meta.MORPHOLOGY_DB}"


class AppState:
    """Analyzer warmup state shared between the loader thread and routes."""

    def __init__(self) -> None:
        self.ready_event = threading.Event()
        self.analyzer = None
        self.load_error: str | None = None
        self.load_seconds: float | None = None


state = AppState()


def _load_analyzer(app_state: AppState) -> None:
    # Imported here (not at module top) so /healthz stays cheap even while
    # the interpreter would otherwise be busy importing analyzer machinery.
    from app.morph_leg import MorphAnalyzer

    try:
        analyzer = MorphAnalyzer()
    except Exception as exc:  # honest readiness: a failed load stays 503
        app_state.load_error = f"{type(exc).__name__}: {exc}"
        log.exception("analyzer load failed")
    else:
        app_state.analyzer = analyzer
        app_state.load_seconds = analyzer.load_seconds
        log.info(
            "analyzer loaded in %.2fs (%d warmup analyses)",
            analyzer.load_seconds,
            analyzer.warmup_analysis_count,
        )
    finally:
        app_state.ready_event.set()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    threading.Thread(target=_load_analyzer, args=(state,), name="analyzer-load", daemon=True).start()
    yield


app = FastAPI(
    title="language-agent verification sidecar (ar)",
    version=meta.CONTRACT_VERSION,
    lifespan=lifespan,
    # Spec-first discipline: this service does not publish an OpenAPI
    # document of its own — the shared hand-authored spec is the only one.
    openapi_url=None,
    docs_url=None,
    redoc_url=None,
)


def readiness_report(app_state: AppState) -> ReadinessReport:
    if app_state.analyzer is not None:
        detail = f"loaded in {app_state.load_seconds:.2f}s" if app_state.load_seconds is not None else None
        return ReadinessReport(ready=True, checks=[ReadinessCheck(id=READY_CHECK_ID, ready=True, detail=detail)])
    detail = app_state.load_error or "still loading"
    return ReadinessReport(ready=False, checks=[ReadinessCheck(id=READY_CHECK_ID, ready=False, detail=detail)])


@app.get("/healthz", response_model=HealthResponse)
def healthz() -> HealthResponse:
    """Liveness: process is up. NEVER touches the model (shared spec)."""
    return HealthResponse(status="ok")


@app.get("/readyz", response_model=None)
def readyz() -> JSONResponse:
    report = readiness_report(state)
    return JSONResponse(
        status_code=200 if report.ready else 503,
        content=report.model_dump(exclude_none=True),
    )


@app.get("/v1/capabilities", response_model=Capabilities)
def capabilities() -> Capabilities:
    return Capabilities(
        language=meta.LANGUAGE,
        contractVersion=meta.CONTRACT_VERSION,
        verificationLegs=list(meta.VERIFICATION_LEGS),
        annotationSchemaId=meta.ANNOTATION_SCHEMA_ID,
        features=list(meta.FEATURES),
    )


@app.post(
    "/v1/verify",
    response_model=VerifyResponse,
    # Optional fields the gate leaves unset (spanGroup, evidence detail)
    # must be ABSENT, not null — the shared spec types them as plain
    # strings, not nullable.
    response_model_exclude_none=True,
)
def verify(req: VerifyRequest):
    # Block (in this worker thread only) until warmup finishes — a request
    # racing the analyzer load waits instead of failing; readiness probes
    # keep traffic away from a cold instance in the deployed topology.
    state.ready_event.wait()
    if state.analyzer is None:
        return JSONResponse(
            status_code=503,
            content=Error(code="ANALYZER_UNAVAILABLE", message="morphology DB failed to load").model_dump(),
        )
    from app.gate import verify_text

    return verify_text(req.targetText, req.intents, state.analyzer)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Every HTTP-layer error rides the contract's Error envelope too —
    e.g. a body that is not even decodable UTF-8 short-circuits inside
    FastAPI as a bare HTTPException(400) before request validation runs
    (found by the Schemathesis fuzz)."""
    return JSONResponse(
        status_code=exc.status_code,
        content=Error(
            code="MALFORMED_BODY" if exc.status_code == 400 else "HTTP_ERROR",
            message=str(exc.detail or "request failed"),
        ).model_dump(),
        # Preserve the exception's own headers — e.g. the RFC-required
        # `Allow` on a 405 (dropping it fails Schemathesis' coverage phase).
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    """Map validation failures onto the contract's Error envelope:
    400 for an unparseable body, 422 for a well-formed but invalid one."""
    errors = exc.errors()
    malformed = any(str(e.get("type", "")).startswith("json") for e in errors)
    message = "; ".join(
        f"{'.'.join(str(part) for part in e.get('loc', ()))}: {e.get('msg', 'invalid')}" for e in errors[:5]
    )
    return JSONResponse(
        status_code=400 if malformed else 422,
        content=Error(
            code="MALFORMED_BODY" if malformed else "INVALID_REQUEST",
            message=message[:500] or "invalid request",
        ).model_dump(),
    )
