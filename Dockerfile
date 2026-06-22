# ── Stage: build-core ────────────────────────────────────────────────────────
# Clones mesahub-core and builds the Go binary from source.
# The Go module lives in server/ subdirectory — go install doesn't work.
# Override MESAHUB_CORE_VERSION at build time to pin a specific commit/tag:
#   docker build --build-arg MESAHUB_CORE_VERSION=main .
FROM golang:1.24-alpine AS build-core
RUN apk add --no-cache gcc musl-dev sqlite-dev git
ARG MESAHUB_CORE_VERSION=trunk
RUN --mount=type=secret,id=gh_token \
    git config --global url."https://$(cat /run/secrets/gh_token)@github.com/".insteadOf "https://github.com/" && \
    git clone --depth 1 --branch ${MESAHUB_CORE_VERSION} \
    https://github.com/mesahub-db/mesahub-core.git /mesahub-core
WORKDIR /mesahub-core/server
RUN CGO_ENABLED=1 GOOS=linux go build -o /go/bin/mesahub-server ./cmd/server

# ── Stage: build-backend ──────────────────────────────────────────────────────
FROM node:22-alpine AS build-backend
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Build the shared emails package first (backend depends on it via file:../emails)
COPY services/emails/package.json ./emails/package.json
RUN --mount=type=cache,id=pnpm-store-backend,target=/root/.local/share/pnpm/store \
    cd emails && pnpm install

COPY services/emails/ ./emails/
RUN cd emails && pnpm run build

# Now install and build the backend
COPY services/backend/package.json services/backend/pnpm-lock.yaml services/backend/pnpm-workspace.yaml ./backend/
RUN --mount=type=cache,id=pnpm-store-backend,target=/root/.local/share/pnpm/store \
    cd backend && pnpm install --frozen-lockfile

COPY services/backend/ ./backend/
RUN cd backend && pnpm run build

# ── Stage: build-admin ────────────────────────────────────────────────────────
FROM node:22-alpine AS build-admin
WORKDIR /app/admin

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY services/admin/package.json services/admin/pnpm-lock.yaml services/admin/pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store-admin,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY services/admin/ ./
RUN pnpm exec vite build

# ── Stage: prod (Caddy + Node + Mailpit) ─────────────────────────────────────
FROM caddy:2-alpine AS caddy-bin

FROM node:22-alpine AS prod
COPY --from=caddy-bin /usr/bin/caddy /usr/bin/caddy
RUN apk add --no-cache curl openssl
WORKDIR /app

# mesahub-server (for embedded mode — skipped if MESAHUB_URL points to external)
COPY --from=build-core /go/bin/mesahub-server /usr/local/bin/mesahub-server
RUN mkdir -p /data
VOLUME ["/data"]

# Install Mailpit binary
ARG TARGETARCH
RUN set -e; \
  MAILPIT_VERSION="v1.21.5"; \
  if [ "$TARGETARCH" = "arm64" ]; then ARCH="arm64"; else ARCH="amd64"; fi; \
  curl -fsSL "https://github.com/axllent/mailpit/releases/download/${MAILPIT_VERSION}/mailpit-linux-${ARCH}.tar.gz" \
    | tar -xz -C /usr/local/bin mailpit; \
  chmod +x /usr/local/bin/mailpit

RUN mkdir -p /usr/share/caddy

# Backend runtime (emails dist is at ../emails relative to backend, per file: dep symlink)
COPY --from=build-backend /app/emails/dist           ./emails/dist
COPY --from=build-backend /app/emails/package.json   ./emails/package.json
COPY --from=build-backend /app/backend/node_modules ./backend/node_modules
COPY --from=build-backend /app/backend/dist          ./backend/dist
COPY services/backend/package.json                   ./backend/

# Admin static files
COPY --from=build-admin /app/admin/dist /usr/share/caddy

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 80
CMD ["/app/start.sh"]
