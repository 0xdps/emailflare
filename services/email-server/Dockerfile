# ── Stage: dev ────────────────────────────────────────────────────────────────
# Build context must be the repo root when used with compose.dev.yaml so that
# packages/email-core and services/emails are available as file: deps.
# Source files and packages are mounted as volumes; the compose command handles
# installing deps and starting the server.
FROM node:26-alpine AS dev
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
EXPOSE 3000

# ── Stage: builder ─────────────────────────────────────────────────────────────
# Used by the root Dockerfile's build-backend stage, not standalone.
# Requires packages/email-core and services/emails to be available in context.
FROM node:26-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# ── Stage: prod ────────────────────────────────────────────────────────────────
FROM node:26-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN corepack enable && corepack prepare pnpm@latest --activate \
    && pnpm install --prod
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
