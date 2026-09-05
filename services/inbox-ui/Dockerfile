# ── Stage: dev ────────────────────────────────────────────────────────────────
FROM node:26-alpine AS dev
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 5174
CMD ["npm", "run", "dev"]

# ── Stage: builder ────────────────────────────────────────────────────────────
FROM node:26-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# ── Stage: prod ───────────────────────────────────────────────────────────────
# inbox-ui static files are served by Caddy in the standalone Docker image.
# This stage is a convenience target if you need a standalone container.
FROM nginx:1.27-alpine AS prod

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
