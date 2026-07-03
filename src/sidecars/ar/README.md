# src/sidecars/ar

The Arabic verification sidecar (Python, FastAPI) — issue #7's walking
skeleton, deliberately **outside** the pnpm workspace globs
(`pnpm-workspace.yaml` lists only `src/packages/*` and `src/apps/*`).

It implements the shared hand-authored contract
`src/packages/contract/sidecar/openapi.yaml` (spec-first, ADR §3.2): the
routes type against `generated/models.py` — the implementation types
AGAINST the contract, it never emits it (the app's own `/openapi.json` is
disabled). Two deterministic gate legs only (the refutation jury and the
2nd diacritizer are named follow-ups, not skeleton scope):

| Leg id | What it checks |
| --- | --- |
| `dediac-roundtrip` | Rule-based, no data: the emitted form decomposes into skeleton + ḥarakāt and reassembles exactly; orphan/stacked marks and half-Latin/half-Arabic splices fail (`app/dediac_leg.py`). |
| `camel-morph` | calima-msa-r13 analyzer membership: analyze the bare skeleton, require the emitted vocalization among the returned **lexical** analyses; `NO_ANALYSIS` → RED, never a silent pass (`app/morph_leg.py`). |

Banding (deterministic mapping of `docs/research/arabic-validation.md` §6;
the fuller rationale is the docstring in `app/gate.py`): both legs pass
exactly → GREEN; core-word match with an unlicensed word-final
(case-ending) vocalization → YELLOW; any deterministic failure → RED.
Turn-level intents drive analysis *selection* + evidence detail; per-token
intended-lemma binding is #9's hot path.

**Out-of-world rule (fail closed; found by PR #29's review):** the hot
path's contract sends pure verified-Arabic `targetText`, so a word-kind
token whose skeleton carries no Arabic-script codepoints (e.g. a
space/NBSP-separated Latin word) bands **RED**, two belts deep: (1) the
script check runs before the analyzer is consulted; (2) the analyzer's
passthrough-class analyses (`pos` foreign/punc/digit — synthetic echoes
whose `diac` equals the input verbatim, emitted even under backoff NONE)
never constitute membership in the exact/core-match filters. Pure digit
runs and punctuation stay non-lexical `num`/`punct` tokens (GREEN, leg 2
honestly absent) — pinned by explicit tests.

## Layout

- `app/` — the FastAPI service (`main.py`), the two legs, the gate, and
  `probe.py` (the hosting-ADR cold-load probe, shipped in the image).
- `generated/models.py` — Pydantic v2 models GENERATED from the shared
  spec. Never edit by hand; regenerate with `pnpm run spec:generate:python`
  (freshness-gated in CI).
- `codegen/` — the generator pin (`requirements.txt`) + its full
  transitive lock (`requirements.lock`, fed to uvx via
  `--with-requirements`).
- `pyproject.toml` + `requirements.lock` / `requirements-dev.lock` — the
  service deps and their full transitive locks (`uv pip compile
  --universal --python-version 3.12`; regenerate commands in the lock
  headers).
- `licenses/` — the GPL-2 notice for the `morphology-db-msa-r13` data
  package (copied into the image at `/licenses`). The service code stays
  MIT — see `licenses/NOTICE.md`.
- `tests/` — golden gate fixtures (values pinned from the calima-msa-r13
  DB itself), contract-lockstep tests, error-envelope tests, the prune
  regression, and `run-schemathesis.sh`.

## Image shape (hosting ADR)

`Dockerfile` follows `docs/decisions/hosting-walking-skeleton.md`:
`python:3.12-slim`; the full lock filtered of the ADR prune list
(`nvidia-*`, `torch`, `triton`, `transformers`, `sympy`, `scikit-learn`,
`pandas`) and installed `--no-deps` (the ADR's sanctioned alternative to
install-then-uninstall — the ML stack never enters any layer); `camel_data
-i morphology-db-msa-r13` at BUILD time with `CAMELTOOLS_DATA` baked, so
runtime is **fully offline** (CI runs the entire suite under
`--network none`). Deploy spec: **1 GiB memory** for this container.

Measured on this shape (see the #7 stage-2 PR for the ADR comparison):
image ≈ 556 MB; analyzer-inclusive cold load ≈ 1.4 s; RSS ≈ 399 MiB;
container start → `/readyz` 200 ≈ 2 s.

## Running it

```sh
# build + serve on :8081 (container :8000)
docker compose --profile sidecar-ar up sidecar-ar

# or directly
docker build --target runtime -t language-agent/sidecar-ar:dev src/sidecars/ar
docker run --rm -p 8081:8000 language-agent/sidecar-ar:dev

# the full test battery, offline, exactly as CI runs it (from the repo root)
docker build --target test -t language-agent/sidecar-ar:test src/sidecars/ar
docker run --rm --network none \
  -v "$PWD/src/packages/contract/sidecar/openapi.yaml:/contract/openapi.yaml:ro" \
  -v "$PWD/src/packages/lang-ar/ar-annotations.schema.json:/contract/ar-annotations.schema.json:ro" \
  language-agent/sidecar-ar:test python -m pytest -q tests
docker run --rm --network none \
  -v "$PWD/src/packages/contract/sidecar/openapi.yaml:/contract/openapi.yaml:ro" \
  language-agent/sidecar-ar:test bash tests/run-schemathesis.sh

# the ADR consistency probe
docker run --rm --network none language-agent/sidecar-ar:dev python -m app.probe
```

`/healthz` is cheap liveness (never touches the model); `/readyz` is
honest readiness (200 only once the analyzer DB is loaded);
`/v1/capabilities` declares `['dediac-roundtrip','camel-morph']` and the
`ar-annotations/v1` schema id; `POST /v1/verify` is the text-in/tokens-out
gate. The Prism mock remains the "null sidecar" for consumers that want
zero Python: `docker compose --profile mock up mock`.
