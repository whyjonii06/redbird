# =============================================================================
# Redbird Backoffice — Production Dockerfile
# =============================================================================
# Build from the monorepo root (context must be the repo root — same reason
# as packages/api/Dockerfile: @redbirdshop/api is a workspace-only package,
# never published to npm, so it must be built from source here rather than
# `npm install`-ed as if it were a registry dependency.
#
#   docker build -f apps/backoffice/Dockerfile -t redbird-backoffice .
# =============================================================================

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc* ./

COPY packages/api/package.json        ./packages/api/package.json
COPY packages/core/package.json       ./packages/core/package.json
COPY packages/trpc/package.json       ./packages/trpc/package.json
COPY packages/plugin-sdk/package.json ./packages/plugin-sdk/package.json
COPY packages/cli/package.json        ./packages/cli/package.json
COPY plugins/ ./plugins/
COPY apps/backoffice/package.json ./apps/backoffice/package.json

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

COPY apps/backoffice/ ./apps/backoffice/

ARG VITE_STOREFRONT_URL=http://localhost:5173
ENV VITE_STOREFRONT_URL=$VITE_STOREFRONT_URL

RUN pnpm --filter @redbird/backoffice run build

# ─── Stage 3: runtime (nginx) ─────────────────────────────────────────────────
FROM nginx:alpine AS runtime

RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    location /events {\n\
        proxy_pass http://api:3000/events;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header Connection "";\n\
        proxy_set_header Host $host;\n\
        proxy_buffering off;\n\
        proxy_cache off;\n\
        proxy_read_timeout 86400s;\n\
    }\n\
\n\
    location /themes {\n\
        proxy_pass http://api:3000/themes;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header Host $host;\n\
    }\n\
\n\
    location /trpc {\n\
        proxy_pass http://api:3000/trpc;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n\
        proxy_set_header X-Forwarded-Proto $scheme;\n\
    }\n\
\n\
    location /webhooks {\n\
        proxy_pass http://api:3000/webhooks;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
    }\n\
\n\
    location /setup {\n\
        proxy_pass http://api:3000/setup;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
    }\n\
\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

COPY --from=builder /app/apps/backoffice/dist /usr/share/nginx/html

EXPOSE 80
