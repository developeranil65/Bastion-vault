FROM node:18-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# ─── Dependencies (prod only) ─────────────────────────────────────────────
FROM base AS deps
WORKDIR /app/apps/api
COPY apps/api/package.json apps/api/package-lock.json* ./
COPY apps/api/prisma ./prisma
RUN npm i --omit=dev --no-fund --no-audit

# ─── Builder (full deps + compile) ────────────────────────────────────────
FROM base AS builder
WORKDIR /app/apps/api
COPY apps/api/package.json apps/api/package-lock.json* ./
COPY apps/api/prisma ./prisma
RUN npm i --no-fund --no-audit
COPY apps/api/ .
RUN npx prisma generate
RUN npx tsc

# ─── Production Runner ────────────────────────────────────────────────────
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

COPY --from=deps /app/apps/api/node_modules ./node_modules

COPY --from=builder /app/apps/api/dist ./dist

COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/apps/api/node_modules/@prisma ./node_modules/@prisma

# Entrypoint script runs prisma db push before starting the server
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER appuser

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["./entrypoint.sh"]
