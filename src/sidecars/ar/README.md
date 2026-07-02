# src/sidecars/ar

The Arabic verification sidecar (Python, FastAPI) — deliberately **outside**
the pnpm workspace globs (`pnpm-workspace.yaml` lists only `src/packages/*`
and `src/apps/*`; confirm with `pnpm -r list`).

What exists now (issue #7's **spec-first opening PR**, per
`docs/decisions/language-module-architecture.md` §3.2 / §5.2):

- `generated/models.py` — Pydantic v2 models GENERATED from the
  hand-authored shared spec `src/packages/contract/sidecar/openapi.yaml`
  via `datamodel-code-generator`. Never edit by hand; regenerate with
  `pnpm run spec:generate:python` (= `scripts/generate-sidecar-models.sh`,
  the same command CI runs before its `git diff --exit-code` freshness
  gate).
- `codegen/requirements.txt` — the exact generator pin.

Still owned by issue #7's **later implementation PRs** (stage 2): the
FastAPI app (its routes MUST type against `generated/models.py` — the
implementation types against the contract, it never emits it), its own
`pyproject.toml`, the pruned Dockerfile per
`docs/decisions/hosting-walking-skeleton.md`, the golden gate fixtures, and
the Schemathesis run against the built image.

Until then, the Prism mock is the "null sidecar": `docker compose --profile
mock up mock` serves the same shared spec on `:4010`.
