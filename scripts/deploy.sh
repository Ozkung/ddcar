#!/bin/bash
set -e

IMAGE="${APP_IMAGE:-deadlylemonate/ddcar:latest}"

echo "==> Building image: $IMAGE"
docker build -t "$IMAGE" .

echo "==> Pushing image: $IMAGE"
docker push "$IMAGE"

echo "==> Done. On server, run:"
echo "    docker compose -f docker-compose.prod.yml --env-file .env.prod pull"
echo "    docker compose -f docker-compose.prod.yml --env-file .env.prod up -d"
