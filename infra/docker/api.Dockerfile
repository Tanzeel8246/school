# Multi-stage build for the Express API (blueprint §11)
FROM node:22-alpine AS build
WORKDIR /app
COPY apps/api/package*.json ./apps/api/
RUN cd apps/api && npm install
COPY apps/api ./apps/api
RUN cd apps/api && npm run build

FROM node:22-alpine AS run
WORKDIR /app/apps/api
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./package.json
EXPOSE 4000
USER node
CMD ["node", "dist/server.js"]
