# syntax=docker/dockerfile:1
# Build context is the repo root (npm workspaces monorepo). Build with:
#   docker build -f frontend/Dockerfile --build-arg NEXT_PUBLIC_API_URL=... -t <tag> .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace=frontend
COPY frontend ./frontend
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build --workspace=frontend

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/frontend/public ./public
COPY --from=build --chown=node:node /app/frontend/.next/standalone/frontend ./
COPY --from=build --chown=node:node /app/frontend/.next/standalone/node_modules ./node_modules
COPY --from=build --chown=node:node /app/frontend/.next/static ./.next/static
USER node
EXPOSE 8080
ENV PORT=8080
CMD ["node", "server.js"]
