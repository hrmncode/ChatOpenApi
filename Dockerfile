# ── Build ──
FROM node:22-alpine AS build

WORKDIR /app

# Copy manifests first so the dependency layer is cached independently of source.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Serve ──
FROM nginx:1.27-alpine

# Runs as an unprivileged user on port 8080; no root, no privileged port.
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN touch /var/run/nginx.pid \
    && chown -R nginx:nginx \
        /var/run/nginx.pid \
        /var/cache/nginx \
        /etc/nginx/conf.d \
        /usr/share/nginx/html

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
