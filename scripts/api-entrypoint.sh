#!/bin/sh
set -e
node scripts/wait.mjs "${POSTGRES_HOST:-postgres}" "${POSTGRES_PORT:-5432}"
node scripts/wait.mjs "${REDIS_HOST:-redis}" "${REDIS_PORT:-6379}"
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
npx tsx packages/db/src/seed.ts
exec npx tsx apps/api/src/index.ts
