# Multi-stage build for the React SPA, served by Nginx which also reverse-proxies
# /api to the API container (blueprint §11).
FROM node:22-alpine AS build
WORKDIR /app
COPY apps/web/package*.json ./
RUN npm install
COPY apps/web ./
# Bake the API base URL into the bundle; /api is proxied by this same Nginx.
ENV VITE_API_URL=/api/v1
RUN npm run build

FROM nginx:1.27-alpine AS run
# SPA-aware Nginx config (history fallback + /api proxy)
COPY infra/nginx/nginx.dev.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
