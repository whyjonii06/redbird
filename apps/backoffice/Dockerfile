# ── Stage 1: builder ────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install from npm (not workspace) — @redbirdshop/api is published
COPY package.json ./
RUN sed -i 's|"@redbirdshop/api": "workspace:\*"|"@redbirdshop/api": "^0.1.0"|g' package.json \
 && sed -i '/workspace:\*/d' package.json \
 && npm install

COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public

ARG VITE_STOREFRONT_URL=http://localhost:5173
ENV VITE_STOREFRONT_URL=$VITE_STOREFRONT_URL

RUN npx vite build

# ── Stage 2: runtime (nginx) ─────────────────────────────────────────────────
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

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
