#!/bin/sh
set -e

echo "▶ Syncing database schema..."
./node_modules/.bin/prisma db push --skip-generate \
  --schema=./packages/db/prisma/schema.prisma

echo "▶ Starting Next.js..."
cd /app/apps/shop
exec /app/node_modules/.bin/next start
