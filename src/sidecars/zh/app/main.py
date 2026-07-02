"""FastAPI app — the zh verification sidecar's HTTP surface.

Implements the shared contract (src/packages/contract/sidecar/openapi.yaml)
verbatim; the routes type against the GENERATED models
(src/sidecars/zh/generated/models.py — regenerated from the spec by
scripts/generate-sidecar-models.sh, freshness-gated in CI). The
implementation types AGAINST the contract; it never emits it.

Endpoint discipline (ADR §3.3, KServe Open Inference Protocol anatomy):

- /healthz  — cheap liveness from the HTTP layer alone; never touches a table.
- /readyz   — honest readiness: 200 only once ALL data tables (CC-CEDICT,
  Unihan, C9 context table, sliver lexicon) and the jieba voter are loaded.
  Warmup is SECONDS-scale (data tables + jieba prefix dict; no model load).
- /v1/capabilities — static declaration; never negotiated.
- /v1/verify — the gate: text-in, banded tokens-out.

Error envelope: the spec's `Error {code, message}` — malformed JSON → 400,
well-formed-but-invalid → 422 (FastAPI's default validation body is
replaced; Schemathesis checks response conformance against the spec).
"""

from __future__ import annotations

import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from generated.models import (
    Capabilities,
    HealthResponse,
    ReadinessCheck,
    ReadinessReport,
    VerifyRequest,
    VerifyResponse,
)

from .gate import ANNOTATION_SCHEMA_ID, LANGUAGE
from .legs import CAPABILITY_LEGS
from .state import READINESS_CHECKS, SidecarState

# Mirrors the shared spec's info.version / @la/contract's CONTRACT_VERSION
# (exact equality, in-tree packs deploy lockstep — ADR §3.5). A unit test
# asserts this equals the spec document's value.
CONTRACT_VERSION = "0.1.0"

READY_TIMEOUT_SECONDS = 60.0


def create_app(
    data_dir: Path | None = None,
    voter=None,
    auto_warmup: bool = True,
) -> FastAPI:
    state = SidecarState(data_dir=data_dir, voter=voter)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if auto_warmup:
            thread = threading.Thread(target=state.warmup, daemon=True, name="zh-warmup")
            thread.start()
        yield

    app = FastAPI(
        title="language-agent verification sidecar (zh)",
        version=CONTRACT_VERSION,
        lifespan=lifespan,
        # The shared spec is the single OpenAPI source of truth; this app's
        # emitted schema is not a contract artifact.
        openapi_url=None,
        docs_url=None,
        redoc_url=None,
    )
    app.state.sidecar = state

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_request: Request, exc: StarletteHTTPException):
        # Every error rides the contract's Error envelope — FastAPI's default
        # {"detail": ...} shape (e.g. its 400 for an unparseable/invalid-UTF-8
        # body) would violate the shared spec's response schema.
        code = "malformed-request" if exc.status_code == 400 else f"http-{exc.status_code}"
        return JSONResponse(
            status_code=exc.status_code,
            content={"code": code, "message": str(exc.detail)},
            # Keep Starlette's headers — e.g. `Allow` on a 405 (RFC 9110).
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(_request: Request, exc: RequestValidationError):
        malformed = any(e.get("type") == "json_invalid" for e in exc.errors())
        if malformed:
            return JSONResponse(
                status_code=400,
                content={"code": "malformed-request", "message": "request body is not valid JSON"},
            )
        detail = "; ".join(
            f"{'.'.join(str(p) for p in e.get('loc', ()))}: {e.get('msg', 'invalid')}"
            for e in exc.errors()[:5]
        )
        return JSONResponse(
            status_code=422,
            content={"code": "invalid-request", "message": detail or "semantically invalid request"},
        )

    @app.get("/healthz", response_model=HealthResponse)
    def healthz() -> HealthResponse:
        # Liveness from the HTTP layer alone — no model/table access, so a
        # wedged table load can never look like a dead process.
        return HealthResponse(status="ok")

    @app.get("/readyz", response_model=ReadinessReport, response_model_exclude_none=True)
    def readyz():
        checks = [
            ReadinessCheck(
                id=check,
                ready=state.checks[check],
                detail=state.detail.get(check)
                if not state.checks[check]
                else None,
            )
            for check in READINESS_CHECKS
        ]
        report = ReadinessReport(ready=state.ready, checks=checks)
        return JSONResponse(
            status_code=200 if state.ready else 503,
            content=report.model_dump(exclude_none=True),
        )

    @app.get("/v1/capabilities", response_model=Capabilities)
    def capabilities() -> Capabilities:
        return Capabilities(
            language=LANGUAGE,
            contractVersion=CONTRACT_VERSION,
            verificationLegs=list(CAPABILITY_LEGS),
            annotationSchemaId=ANNOTATION_SCHEMA_ID,
            features=[],
        )

    @app.post(
        "/v1/verify",
        response_model=VerifyResponse,
        response_model_exclude_none=True,
    )
    def verify(request: VerifyRequest) -> VerifyResponse:
        # Sync route → runs in the threadpool; waiting on warmup here keeps
        # /healthz and /readyz honest while never serving from unloaded
        # tables (fail-closed: no table, no verdict).
        state.ready_event.wait(timeout=READY_TIMEOUT_SECONDS)
        if state.gate is None:
            raise RuntimeError("gate unavailable after warmup timeout")
        return state.gate.verify(request)

    return app


app = create_app()
