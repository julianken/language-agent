# sidecars/zh

Placeholder directory. This holds the Chinese verification sidecar (Python,
FastAPI) — deliberately **outside** the pnpm workspace globs
(`pnpm-workspace.yaml` lists only `packages/*` and `apps/*`; confirm with
`pnpm -r list`).

Real content is owned by the zh walking-skeleton sidecar child. Per
`docs/decisions/language-module-architecture.md`'s dual-instance amendment,
the zh v0 sidecar is deterministic-legs-only over a closed, curation-time
fully-gated seed — the neural legs (g2pW + AS-HanLP) stay dormant until
their own trigger fires (see `GAPS.md`).
