#!/bin/sh
set -e

echo "▶ Syncing database schema..."
./node_modules/.bin/prisma db push --skip-generate

echo "▶ Starting Next.js..."
exec "$@"
