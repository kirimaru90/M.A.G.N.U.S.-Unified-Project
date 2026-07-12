#!/usr/bin/env bash
#
# start.sh — runs ON the server (/home/ubuntu/workspace/robco).
# Syncs the repo to the requested branch and (re)builds the docker stack.
#
# Usage: ./start.sh [branch]   (defaults to "dev")
#
set -euo pipefail

BRANCH="${1:-dev}"
cd "$(dirname "$0")"

echo "=========================================="
echo "==> robco deploy starting"
echo "==> Directory : $(pwd)"
echo "==> Branch    : $BRANCH"
echo "=========================================="

echo "==> [1/5] Fetching latest refs from origin..."
git fetch origin

echo "==> [2/5] Checking out branch '$BRANCH'..."
git checkout "$BRANCH"

echo "==> [3/5] Pulling latest '$BRANCH'..."
git pull origin "$BRANCH"

echo "==> [4/5] Building and starting containers (docker compose up -d --build)..."
# Stamp the pip-boy PWA's service-worker cache version from the deployed commit,
# so the version changes iff the code changed and installed clients self-heal.
export BUILD_ID="$(git rev-parse --short HEAD)"
echo "==> BUILD_ID=$BUILD_ID"
docker compose up -d --build

echo "==> [5/5] Container status:"
docker compose ps

echo "=========================================="
echo "==> Done. robco is up on branch '$BRANCH'."
echo "=========================================="
