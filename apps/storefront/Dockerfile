# ── Stage 1: builder ────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN sed -i 's|"@redbirdshop/api-types": "workspace:\*"|"@redbirdshop/api-types": "^0.1.0"|g' package.json \
 && sed -i 's|"@redbirdshop/api": "workspace:\*"|"@redbirdshop/api": "^0.1.0"|g' package.json \
 && npm install

COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src

RUN npx vite build

# ── Stage 2: runtime (nginx) ─────────────────────────────────────────────────
FROM nginx:alpine AS runtime

RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    location /trpc {\n\
        proxy_pass http://api:3000/trpc;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
    }\n\
\n\
    location /meta.json {\n\
        proxy_pass http://api:3000/meta.json;\n\
        proxy_http_version 1.1;\n\
    }\n\
\n\
    location /uploads {\n\
        proxy_pass http://api:3000/uploads;\n\
        proxy_http_version 1.1;\n\
    }\n\
\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
