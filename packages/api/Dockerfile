# =============================================================================
# Redbird API — Production Dockerfile
# =============================================================================
#
# USAGE
# -----
# Build from the monorepo root (IMPORTANT: context must be the repo root):
#
#   docker build -f packages/api/Dockerfile -t redbird-api .
#
# Run with a pre-configured store:
#
#   docker run -p 3000:3000 \
#     -v /path/to/your/redbird.config.js:/app/packages/api/redbird.config.ts:ro \
#     -v /path/to/your/.env:/app/.env:ro \
#     redbird-api
#
# CONFIG NOTE
# -----------
# packages/api/src/dev.ts (compiled to dist/dev.js) loads the store config via:
#
#   import(pathToFileURL('<monorepo-root>/packages/api/redbird.config.ts'))
#
# Node.js cannot import a raw .ts file at runtime. You have two options:
#
#   1. Mount a plain JavaScript file (.js / .mjs) to the .ts path shown above
#      (Node will import it fine — the .ts extension in the path is just a name).
#      Example: `redbird.config.js` content:
#
#        import { defineConfig } from '@redbird/core'
#        import { stripe } from '@redbird/plugin-stripe'
#        export default defineConfig({ storeName: '...', plugins: [stripe({...})] })
#
#   2. Let the container run in first-boot "setup wizard" mode (no config mounted):
#      it will listen on port 3000 and serve the setup HTTP endpoint until you
#      POST /setup — after which it writes redbird.config.ts and boots the API.
#      NOTE: in ephemeral containers, this written file is lost on restart; prefer
#      option 1 for production deployments.
#
# ENVIRONMENT VARIABLES (passed via -e or --env-file)
# ----------------------------------------------------
#   DATABASE_URL       — PostgreSQL connection string (required in production)
#   ADMIN_KEY          — Admin bearer token
#   JWT_SECRET         — JWT signing secret
#   DEFAULT_CURRENCY   — e.g. EUR
#   PORT               — defaults to 3000
#   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, etc.
#
# =============================================================================

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
# Install all workspace dependencies (dev + prod) so the builder can compile.
FROM node:22-alpine AS deps

# Install pnpm via corepack (matches the packageManager field in root package.json)
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

WORKDIR /app

# Copy workspace manifests first (better layer caching — only re-runs pnpm install
# when lock file or any package.json changes).
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc* ./

# packages/
COPY packages/api/package.json        ./packages/api/package.json
COPY packages/core/package.json       ./packages/core/package.json
COPY packages/trpc/package.json       ./packages/trpc/package.json
COPY packages/plugin-sdk/package.json ./packages/plugin-sdk/package.json
COPY packages/cli/package.json        ./packages/cli/package.json

# plugins/ — copy the whole tree so every module's package.json is present for
# the workspace graph (future-proof: new modules need no Dockerfile edit).
COPY plugins/ ./plugins/

# apps/ (manifests only — we won't build them, but pnpm needs them for the workspace graph)
COPY apps/backoffice/package.json         ./apps/backoffice/package.json
COPY apps/marketplace/package.json        ./apps/marketplace/package.json
COPY apps/storefront/package.json         ./apps/storefront/package.json
COPY apps/storefront-b2b/package.json     ./apps/storefront-b2b/package.json
COPY apps/storefront-classic/package.json ./apps/storefront-classic/package.json
COPY apps/storefront-editorial/package.json ./apps/storefront-editorial/package.json

# tests-integration (may have a package.json)
COPY tests-integration/package.json       ./tests-integration/package.json

RUN pnpm install --frozen-lockfile

# ─── Stage 2: builder ─────────────────────────────────────────────────────────
# Copy all source files and build the packages the API depends on.
FROM deps AS builder

WORKDIR /app

# Copy root tsconfig that all packages extend
COPY tsconfig.base.json ./

# Build @redbirdshop/core first (API and plugins depend on it)
COPY packages/core/ ./packages/core/
RUN pnpm --filter @redbirdshop/core run build

# Build @redbirdshop/trpc (API and module routers depend on it; needs core)
COPY packages/trpc/ ./packages/trpc/
RUN pnpm --filter @redbirdshop/trpc run build

# Build @redbirdshop/plugin-sdk (plugins depend on it)
COPY packages/plugin-sdk/ ./packages/plugin-sdk/
RUN pnpm --filter @redbirdshop/plugin-sdk run build

# Build all plugins (dev.ts dynamically imports them at runtime)
COPY plugins/ ./plugins/
RUN pnpm --filter './plugins/*' run build

# Build @redbirdshop/api
COPY packages/api/ ./packages/api/
RUN pnpm --filter @redbirdshop/api run build

# Package the sellable storefront themes into self-contained .zip files served
# by /themes/:id/download (node_modules/.next excluded via .dockerignore).
COPY apps/storefront-classic   ./apps/storefront-classic
COPY apps/storefront-editorial ./apps/storefront-editorial
COPY apps/storefront-b2b       ./apps/storefront-b2b
COPY scripts ./scripts
RUN node scripts/package-themes.mjs

# ─── Stage 3: runner ──────────────────────────────────────────────────────────
# Copy node_modules directly from builder to avoid pnpm symlink issues in prod.
FROM node:22-alpine AS runner

WORKDIR /app

# Copy the entire node_modules tree from builder (includes all deps + symlinks)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/api/node_modules        ./packages/api/node_modules
COPY --from=builder /app/packages/core/node_modules       ./packages/core/node_modules
COPY --from=builder /app/packages/trpc/node_modules       ./packages/trpc/node_modules
COPY --from=builder /app/packages/plugin-sdk/node_modules ./packages/plugin-sdk/node_modules

# Workspace package node_modules (symlinks into the pnpm store)
COPY --from=builder /app/packages/core/node_modules       ./packages/core/node_modules
COPY --from=builder /app/packages/trpc/node_modules       ./packages/trpc/node_modules
COPY --from=builder /app/packages/plugin-sdk/node_modules ./packages/plugin-sdk/node_modules

# All plugins/modules in one shot (node_modules + package.json + dist) so that
# adding a new module never requires editing this Dockerfile again.
COPY --from=builder /app/plugins ./plugins

# Workspace package manifests (needed for Node to resolve workspace symlinks)
COPY --from=builder /app/packages/core/package.json       ./packages/core/package.json
COPY --from=builder /app/packages/trpc/package.json       ./packages/trpc/package.json
COPY --from=builder /app/packages/plugin-sdk/package.json ./packages/plugin-sdk/package.json

# Copy compiled dist + drizzle migrations (needed by redbird.init() at runtime)
COPY --from=builder /app/packages/core/drizzle/    ./packages/core/drizzle/
COPY --from=builder /app/packages/core/dist/       ./packages/core/dist/
COPY --from=builder /app/packages/trpc/dist/       ./packages/trpc/dist/
COPY --from=builder /app/packages/plugin-sdk/dist/ ./packages/plugin-sdk/dist/
COPY --from=builder /app/packages/api/dist/        ./packages/api/dist/
# Sellable storefront theme zips served by /themes/:id/download
COPY --from=builder /app/packages/api/themes/      ./packages/api/themes/
# Embeddable TTF for PDF/A-3 (Factur-X) invoices
COPY --from=builder /app/packages/api/assets/      ./packages/api/assets/

# The API resolves ROOT as three levels up from packages/api/dist/dev.js:
#   resolve(dirname(import.meta.url), '../../..') → /app
# So the config volume must be mounted at:
#   /app/packages/api/redbird.config.ts
# (even though it is a .js file — Node.js will import it correctly regardless of extension)
EXPOSE 3000

# Run the compiled entrypoint
CMD ["node", "packages/api/dist/dev.js"]
