# src/sidecars/ar

Placeholder directory. This holds the Arabic verification sidecar (Python,
FastAPI) — deliberately **outside** the pnpm workspace globs
(`pnpm-workspace.yaml` lists only `src/packages/*` and `src/apps/*`; confirm with
`pnpm -r list`).

Real content — the FastAPI app, its own `pyproject.toml`, the Pydantic
models generated from `src/packages/contract/sidecar/openapi.yaml`, and the
Dockerfile — is owned by issue #7 (Arabic sidecar), which opens with the
spec-first PR per `docs/decisions/language-module-architecture.md` §3.2 and
§5.2.
