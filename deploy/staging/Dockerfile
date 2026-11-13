FROM node:22-bookworm-slim AS api-build
WORKDIR /app
COPY package.json ./
COPY apps/api/package*.json apps/api/
RUN npm ci --prefix apps/api
COPY apps/api/tsconfig*.json apps/api/
COPY apps/api/src apps/api/src
COPY src src
RUN npm run --prefix apps/api build

FROM node:22-bookworm-slim AS api
ENV NODE_ENV=production
WORKDIR /app
COPY apps/api/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=api-build /app/apps/api/dist/ ./
USER node
CMD ["node", "apps/api/src/server.js"]

FROM node:22-bookworm-slim AS mobile-build
WORKDIR /app
COPY package*.json ./
COPY mobile_app/package*.json mobile_app/
COPY apps/api/package*.json apps/api/
RUN npm ci && npm ci --prefix mobile_app && npm ci --prefix apps/api
COPY src src
COPY apps/api/src apps/api/src
COPY scripts/diagnostics scripts/diagnostics
COPY mobile_app mobile_app
ARG EXE_PUBLIC_SUPABASE_KEY
ENV VITE_EXE_ONLINE=1 \
    VITE_MASCOT_LEARNING_ENABLED=0 \
    VITE_SUPABASE_URL=https://yqikecqeijeaygmmjdyg.supabase.co
RUN node -e 'if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(process.env.EXE_PUBLIC_SUPABASE_KEY || "")) process.exit(1)' \
    && VITE_SUPABASE_PUBLISHABLE_KEY="$EXE_PUBLIC_SUPABASE_KEY" npm run --prefix mobile_app build

FROM caddy:2.11-alpine AS edge
COPY --from=mobile-build /app/mobile_app/dist/ /srv/
COPY deploy/staging/Caddyfile /etc/caddy/Caddyfile
