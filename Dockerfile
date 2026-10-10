# syntax=docker/dockerfile:1

# =============================================================================
# LearnMap — self-hosted Docker image
#
# Builds the app with the docker Vite config (filesystem storage instead of
# R2) and serves it with Bun. Dependencies are installed with pnpm because
# the repository's lockfile is pnpm-lock.yaml; Bun is the runtime.
#
#   docker build -t learnmap .
#   docker run --rm -p 3000:3000 -v learnmap-data:/app/data learnmap
# =============================================================================

# ---------- Stage 1: install dependencies ----------
FROM node:22-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---------- Stage 2: build the app (docker target) ----------
FROM deps AS build
# Build-time env. VITE_* variables are inlined into the client bundle, so the
# public URL must be known at build time.
ARG VITE_APP_URL
ARG VITE_SENTRY_DSN
ENV VITE_APP_URL=$VITE_APP_URL \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN
COPY . .
RUN pnpm exec vp build -c vite.docker.config.ts

# ---------- Stage 3: runtime ----------
FROM oven/bun:1.2-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

# Application (built bundle + client assets).
COPY --from=build /app/dist ./dist
COPY --from=build /app/docker ./docker

# Node modules (includes devDependencies so `drizzle-kit migrate` and the
# seed scripts can run inside the image).
COPY --from=deps /app/node_modules ./node_modules

# Files needed by drizzle-kit (migrations) and the seed scripts (tsx).
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/worker-configuration.d.ts ./worker-configuration.d.ts

# Local SQLite database + uploaded material images live here. Mount a volume
# at /app/data to persist them across container restarts.
RUN mkdir -p /app/data/uploads && chown -R bun:bun /app
USER bun

EXPOSE 3000
CMD ["bun", "docker/server.ts"]
