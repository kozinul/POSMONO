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
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/node_modules ./shared/node_modules
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/package.json .
COPY --from=builder /app/backend/package.json ./backend/

EXPOSE 3000
CMD ["node", "backend/dist/bootstrap/app.js"]
