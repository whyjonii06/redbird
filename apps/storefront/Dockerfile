# =============================================================================
# Redbird Storefront — Production Dockerfile (SSR)
# =============================================================================
# Build from the monorepo root — @redbirdshop/api-types is a workspace-only
# package (never published to npm) and its own build needs @redbirdshop/api's
# real types resolved, so the whole chain is built from source here, same
# reasoning as packages/api/Dockerfile.
#
# The storefront now does real SSR (entry-client.tsx / entry-server.tsx /
# server.js) — this is no longer a static SPA served by nginx. The runtime
# stage runs `node server.js` directly.
#
#   docker build -f apps/storefront/Dockerfile -t redbird-storefront .
# =============================================================================

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc* ./

COPY packages/api/package.json        ./packages/api/package.json
COPY packages/api-types/package.json  ./packages/api-types/package.json
COPY packages/core/package.json       ./packages/core/package.json
COPY packages/trpc/package.json       ./packages/trpc/package.json
COPY packages/plugin-sdk/package.json ./packages/plugin-sdk/package.json
COPY packages/cli/package.json        ./packages/cli/package.json
COPY plugins/ ./plugins/
COPY apps/storefront/package.json ./apps/storefront/package.json

RUN pnpm install --frozen-lockfile

# ─── Stage 2: builder ─────────────────────────────────────────────────────────
FROM deps AS builder

WORKDIR /app

COPY tsconfig.base.json ./

COPY packages/core/ ./packages/core/
RUN pnpm --filter @redbirdshop/core run build

COPY packages/trpc/ ./packages/trpc/
RUN pnpm --filter @redbirdshop/trpc run build

COPY packages/plugin-sdk/ ./packages/plugin-sdk/
RUN pnpm --filter @redbirdshop/plugin-sdk run build

COPY plugins/ ./plugins/
RUN pnpm --filter './plugins/*' run build

COPY packages/api/ ./packages/api/
RUN pnpm --filter @redbirdshop/api run build

COPY packages/api-types/ ./packages/api-types/
RUN pnpm --filter @redbirdshop/api-types run build

COPY apps/storefront/ ./apps/storefront/

# Baked into the client bundle at build time (import.meta.env.VITE_API_URL) —
# the browser can't resolve internal docker hostnames, so this must be the
# public API URL, same one any third-party headless consumer would use.
ARG VITE_API_URL=https://api.redbirdshop.dev
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm --filter @redbird/storefront run build

# ─── Stage 3: runtime (node, SSR) ──────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
# Read at runtime by server.js for its server-side prefetch fetches.
ARG VITE_API_URL=https://api.redbirdshop.dev
ENV VITE_API_URL=$VITE_API_URL

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/storefront/node_modules ./apps/storefront/node_modules
COPY --from=builder /app/apps/storefront/dist    ./apps/storefront/dist
COPY --from=builder /app/apps/storefront/server.js  ./apps/storefront/server.js
COPY --from=builder /app/apps/storefront/index.html ./apps/storefront/index.html
COPY --from=builder /app/apps/storefront/package.json ./apps/storefront/package.json

WORKDIR /app/apps/storefront

EXPOSE 5173

CMD ["node", "server.js"]
