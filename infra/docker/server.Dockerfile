# Multi-stage build for @la/server (the Node/TS SSE server — the Cloud Run
# ingress container). ONE image for both instances: LANGUAGE is an env var
# (infra/modules/cloud-run-service), never a build-time split — the
# registry's lazy import means the unselected pack never loads either way,
# so building this once and reusing it for both instances is correct, not
# an oversight.
#
# Build context is the REPO ROOT (not src/apps/server/) — the pnpm workspace
# needs the root lockfile + every workspace package @la/server depends on
# (@la/contract, @la/engine, @la/lang-ar, @la/lang-fake, @la/lang-zh).
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
COPY src/packages src/packages
COPY src/apps/server src/apps/server

# Build order matches ci.yml's note: workspace `exports` maps resolve
# @la/* only to ./dist/*, so cross-package imports need every dependency
# built before @la/server's own build step runs. `pnpm run build` at the
# workspace root is topological (pnpm -r), so this single command covers it.
RUN pnpm run build

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
COPY --from=build /repo/src/apps/server/dist src/apps/server/dist
COPY --from=build /repo/src/apps/server/fixtures src/apps/server/fixtures

EXPOSE 8080
CMD ["node", "src/apps/server/dist/http/main.js"]
