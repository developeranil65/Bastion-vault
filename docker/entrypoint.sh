#!/bin/sh
set -e

echo "🔧 Applying Prisma schema..."
if ! npx prisma migrate deploy 2>&1; then
  echo "⚠ prisma migrate deploy failed; falling back to prisma db push"
  npx prisma db push --skip-generate 2>&1 || {
    echo "❌ Prisma schema sync failed after migrate deploy failure"
    exit 1
  }
else
  # Edge case: migrate deploy can be "successful" when no migrations exist,
  # leaving a fresh database without application tables. Verify schema exists.
  if ! npx prisma db execute --stdin --schema ./prisma/schema.prisma >/dev/null 2>&1 <<'SQL'
SELECT 1 FROM "User" LIMIT 1;
SQL
  then
    echo "⚠ Core tables not found after migrate deploy; bootstrapping with prisma db push"
    npx prisma db push --skip-generate 2>&1 || {
      echo "❌ Prisma schema bootstrap failed"
      exit 1
    }
  fi
fi

echo "🚀 Starting Bastion Vault API..."
exec node dist/index.js
