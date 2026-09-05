# ── Stage: dev ────────────────────────────────────────────────────────────────
FROM node:26-alpine AS dev
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev"]

# ── Stage: builder ─────────────────────────────────────────────────────────────
FROM node:26-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# ── Stage: prod (nginx static + proxy) ────────────────────────────────────────
FROM nginx:1.27-alpine AS prod

COPY --from=builder /app/dist /usr/share/nginx/html
# nginx auto-runs envsubst on *.template files → resolves $BACKEND_URL
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
