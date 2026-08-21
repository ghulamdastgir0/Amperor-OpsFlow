# syntax=docker/dockerfile:1
# Build context is the repo root (npm workspaces monorepo — the lockfile
# lives at the root, not per-package). Build with:
#   docker build -f backend/Dockerfile -t <tag> .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY backend/prisma ./backend/prisma
RUN npm ci --workspace=backend
COPY backend ./backend
RUN npm run prisma:generate --workspace=backend
RUN npm run build --workspace=backend
RUN npm prune --omit=dev --workspace=backend

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/backend/node_modules ./backend/node_modules
COPY --from=build --chown=node:node /app/backend/dist ./backend/dist
COPY --from=build --chown=node:node /app/backend/prisma ./backend/prisma
COPY --from=build --chown=node:node /app/backend/package.json ./backend/package.json
WORKDIR /app/backend
USER node
EXPOSE 8080
CMD ["node", "dist/main"]
