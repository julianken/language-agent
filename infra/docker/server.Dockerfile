# Multi-stage build for @la/server (the Node/TS SSE server — the Cloud Run
# ingress container). ONE image for both instances: LANGUAGE is an env var
# (infra/modules/cloud-run-service), never a build-time split — the
# registry's lazy import means the unselected pack never loads either way,
# so building this once and reusing it for both instances is correct, not
# an oversight. Same invariant now also covers the web bundle it serves
# (language-router-gateway plan, Task 6, R-B): ONE @la/web SITE build
# (Vite `base: "./"`), not a per-instance web build — the runtime server
# splices the instance's `<base href>` into index.html per-request from
# its own LANGUAGE env, so no image split is needed for that either.
#
# Build context is the REPO ROOT (not src/apps/server/) — the pnpm workspace
# needs the root lockfile + every workspace package @la/server depends on
# (@la/contract, @la/engine, @la/lang-ar, @la/lang-fake, @la/lang-zh) plus
# @la/web (the site bundle this image now also serves).
# Authored only — never built/pushed by this PR (issue #11 PR1 is
# author+plan-only; the real build runs in CI at the keys checkpoint).
#
#   docker build -f infra/docker/server.Dockerfile -t <registry>/server:<tag> .

FROM node:24-slim AS build
WORKDIR /repo

# Pin the same pnpm version the workspace declares (package.json
# "packageManager") so lockfile resolution is identical to CI.
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate

# Copy manifests first for layer caching, then install with the frozen
# lockfile (matches ci.yml's `pnpm install --frozen-lockfile`).
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY src/packages/contract/package.json src/packages/contract/package.json
COPY src/packages/engine/package.json src/packages/engine/package.json
COPY src/packages/lang-fake/package.json src/packages/lang-fake/package.json
COPY src/packages/lang-ar/package.json src/packages/lang-ar/package.json
COPY src/packages/lang-zh/package.json src/packages/lang-zh/package.json
COPY src/packages/lang-conformance/package.json src/packages/lang-conformance/package.json
COPY src/apps/server/package.json src/apps/server/package.json
COPY src/apps/web/package.json src/apps/web/package.json
RUN pnpm install --frozen-lockfile

# Now the real source — invalidates only from here down on a source change.
COPY tsconfig.base.json ./
# @la/web's tokens.json -> CSS custom-property bridge imports this by
# relative path (src/apps/web/src/tokens/applyTokens.ts) — without it the
# site build fails UNRESOLVED_IMPORT (caught by this task's own local
# `docker build` verification; not needed at runtime, only baked into the
# built JS/CSS at this build step).
COPY tokens.json ./
COPY src/packages src/packages
COPY src/apps/server src/apps/server
COPY src/apps/web src/apps/web

# Build order matches ci.yml's note: workspace `exports` maps resolve
# @la/* only to ./dist/*, so cross-package imports need every dependency
# built before @la/server's own build step runs. Filter to @la/server AND
# its dependency closure (`...` suffix) — pnpm builds them topologically.
# NOT a workspace-wide `pnpm run build`: @la/web's OWN "build" script is a
# `tsc` library build (the shell's ".") that ignores src/app — irrelevant
# here and previously broke this image when @la/web's source wasn't even
# COPY'd in. What this image actually needs is @la/web's SITE bundle
# (language-router-gateway plan, Task 6, R-B): built ONCE with Vite
# `base: "./"` (relative asset URLs — @la/web/vite.config.ts), served from
# whatever path prefix the runtime server mounts it under via a
# server-injected `<base href>` (see server.ts's `injectBaseHref`) — so
# there is no per-instance web build/image here, just this one bundle.
RUN pnpm --filter "@la/server..." build
RUN pnpm --filter @la/web build:site

# ── Runtime stage — no toolchain, no devDependencies, no source outside dist.
FROM node:24-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@11.5.2 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY src/packages/contract/package.json src/packages/contract/package.json
COPY src/packages/engine/package.json src/packages/engine/package.json
COPY src/packages/lang-fake/package.json src/packages/lang-fake/package.json
COPY src/packages/lang-ar/package.json src/packages/lang-ar/package.json
COPY src/packages/lang-zh/package.json src/packages/lang-zh/package.json
COPY src/packages/lang-conformance/package.json src/packages/lang-conformance/package.json
COPY src/apps/server/package.json src/apps/server/package.json
COPY src/apps/web/package.json src/apps/web/package.json
RUN pnpm install --frozen-lockfile --prod

COPY --from=build /repo/src/packages/contract/dist src/packages/contract/dist
COPY --from=build /repo/src/packages/engine/dist src/packages/engine/dist
COPY --from=build /repo/src/packages/lang-fake/dist src/packages/lang-fake/dist
COPY --from=build /repo/src/packages/lang-ar/dist src/packages/lang-ar/dist
COPY --from=build /repo/src/packages/lang-zh/dist src/packages/lang-zh/dist
# The pack asset DATA dirs (seed vocab etc.) — the server's composeApp boot
# validates these via assertAssetsPresent against ASSETS_ROOT (set by the
# Cloud Run module to /repo/src/packages/lang-<lang>/assets). dist alone is
# not enough; without these the server boots-fails "asset 'seedVocab' missing".
COPY --from=build /repo/src/packages/lang-ar/assets src/packages/lang-ar/assets
COPY --from=build /repo/src/packages/lang-zh/assets src/packages/lang-zh/assets
COPY --from=build /repo/src/apps/server/dist src/apps/server/dist
COPY --from=build /repo/src/apps/server/fixtures src/apps/server/fixtures
# The web SITE bundle (Task 6, R-B) — WEB_DIST (cloud-run-service module)
# points here so http/main.ts's `webDist` serves it; the built index.html
# gets its `<base href>` spliced in at serve time, not baked in here.
COPY --from=build /repo/src/apps/web/dist-site /repo/web-dist

EXPOSE 8080
CMD ["node", "src/apps/server/dist/http/main.js"]
