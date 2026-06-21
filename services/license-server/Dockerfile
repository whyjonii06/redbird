# ── Stage 1: builder ────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# better-sqlite3 needs a C compiler and Python to rebuild the native addon
RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

# Copy manifests first for layer caching
COPY package.json ./

# Install all deps (including devDependencies needed for tsc)
RUN npm install

# Copy source and compile
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Copy production node_modules (includes the pre-built native addon)
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 4000

CMD ["node", "dist/index.js"]
