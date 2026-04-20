#!/usr/bin/env bash
# ============================================================
# Bastion Vault — Local Development Setup
# ============================================================
# Usage: bash scripts/setup-dev.sh
#
# Prerequisites:
#   - Node.js >= 18
#   - Docker & Docker Compose (for PostgreSQL + Redis)
# ============================================================

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[setup]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
err()  { echo -e "${RED}[error]${NC} $1"; exit 1; }

# ─── Check prerequisites ────────────────────────────────────
command -v node >/dev/null 2>&1 || err "Node.js is required but not installed."
command -v docker >/dev/null 2>&1 || warn "Docker not found — you'll need to run PostgreSQL and Redis manually."

NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
  err "Node.js >= 18 required (found v$(node -v))"
fi

log "Node.js $(node -v) ✓"

# ─── Start infrastructure ───────────────────────────────────
if command -v docker >/dev/null 2>&1; then
  log "Starting PostgreSQL & Redis via Docker Compose..."
  docker compose -f docker/compose.yml up -d postgres redis
  log "Waiting for PostgreSQL to be ready..."
  sleep 3
fi

# ─── Install dependencies ───────────────────────────────────
log "Installing root dependencies..."
npm install

log "Installing API dependencies..."
cd apps/api
npm install

# ─── Setup environment ──────────────────────────────────────
if [ ! -f .env ]; then
  log "Creating .env from .env.example..."
  cp .env.example .env
  warn "Please update .env with your configuration before running the API."
else
  log ".env already exists ✓"
fi

# ─── Generate Prisma Client ─────────────────────────────────
log "Generating Prisma Client..."
npx prisma generate

# ─── Run database migrations ────────────────────────────────
log "Syncing schema to database..."
npx prisma db push 2>/dev/null || warn "Database sync failed. Is PostgreSQL running?"

cd ../..

log ""
log "-------------------------------------------------------"
log "Setup complete."
log ""
log "Start the API: cd apps/api && npm run dev"
log "API Docs: http://localhost:3000/api-docs"
log "Health Check: http://localhost:3000/health"
log "-------------------------------------------------------"
