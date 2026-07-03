# @la/router — the language gateway (`lexercon.com`)

A single **self-contained** HTML page: the quiet gateway that routes visitors
to the Arabic (`/ar/`) and Chinese (`/zh/`) instances. Approved design +
mockup: `docs/superpowers/specs/2026-07-03-language-router-gateway-design.md`.
Implementation plan: `docs/superpowers/plans/2026-07-03-language-router-gateway.md`.

## What's here

- **`index.html`** — the production gateway. Fully self-contained: inlined CSS
  (every value a `DESIGN.md` §0 token) and the three type faces embedded as
  woff2 **data URIs**, subset to only the glyphs shown (`العربية` in Amiri,
  `中文` in Noto Serif TC, the Latin wordmark/tagline in Inter). No external
  requests — the CSP-strict, offline-first constraint holds. It is served at
  the apex by the routing Cloudflare Worker, which embeds this file's contents
  (plan **R-A** — avoids a Cloudflare provider v4→v5 migration for Workers
  Static Assets).

## Regenerating the embedded fonts

The fonts are subset from `@fontsource/{amiri,noto-serif-tc,inter}` to the
gateway's exact glyph set (see plan Task 2 — port the verified subset step to
Node `subset-font`, or the fonttools approach used to produce the current
build). The Noto Serif TC face for `中`(U+4E2D)+`文`(U+6587) is subset file
`noto-serif-tc-123-400-normal.woff2` (resolve by cmap scan, not a hard-coded
index, so it survives a fontsource bump).

## Not yet wired (see the plan)

- The routing Worker that embeds this page + proxies `/ar` `/zh` (Task 7–8).
- Per-language app base-path serving (Task 5–6).
- Terraform / hosting-ADR reconciliation (Task 8–9).

These depend on the deploy branch (`issue-11-deploy-live`) merging to `main`.
