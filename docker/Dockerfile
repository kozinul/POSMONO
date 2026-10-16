FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY backend/package.json backend/
COPY shared/package.json shared/
COPY frontend/package.json frontend/
RUN corepack enable && pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# pnpm links packages from backend/node_modules into the root .pnpm store, so the
# root node_modules must ship too — without it every dependency symlink dangles.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/shared/node_modules ./shared/node_modules
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/package.json .
COPY --from=builder /app/backend/package.json ./backend/
# `@posmono/shared` points `main` at its TypeScript source so ts-node/vitest/vite can
# consume it with no build step. Plain Node here only runs JS, so repoint to the
# compiled output (the source tree is not even copied into this stage).
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('shared/package.json','utf8'));p.main='dist/index.js';p.types='dist/index.d.ts';fs.writeFileSync('shared/package.json',JSON.stringify(p,null,2))"

EXPOSE 3000
CMD ["node", "backend/dist/bootstrap/app.js"]
