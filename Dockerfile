# syntax=docker/dockerfile:1

# ---- build: compile the static SPA ----
# Runs on the build machine's own architecture: the output is plain HTML/JS/CSS, so it's the
# same for every target, and Node/Vite's native binaries crash under QEMU arm64 emulation.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

# ---- serve: unprivileged nginx (listens on 8080, runs as non-root) ----
FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
