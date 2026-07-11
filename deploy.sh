#!/usr/bin/env bash
#
# deploy.sh — runs LOCALLY. Detects your current local branch, SSHes into the
# server, and triggers start.sh there for that same branch.
#
# The server pulls from origin, so make sure your branch is pushed first.
#
# Usage: ./deploy.sh
#
set -euo pipefail

HOST="ubuntu@92.5.52.16"
DIR="/home/ubuntu/workspace/robco"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"

echo "=========================================="
echo "==> Deploying robco"
echo "==> Server : $HOST"
echo "==> Path   : $DIR"
echo "==> Branch : $BRANCH (current local branch)"
echo "=========================================="

echo "==> Connecting via SSH and running start.sh on the server..."
ssh "$HOST" "cd '$DIR' && ./start.sh '$BRANCH'"

echo "=========================================="
echo "==> Deploy finished for branch '$BRANCH'."
echo "=========================================="
