#!/usr/bin/env bash
# Compose smoke test: assert each Magnus hostname serves its app and that a
# same-origin /api request reaches the API through the edge proxy.
#
# Prereqs: the Magnus stack is up (`docker compose up -d`) and the edge proxy is
# running with deploy/magnus.caddy imported (see deploy/README.md).
#
# Usage:
#   BASE_HOST=127.0.0.1.nip.io ./deploy/smoke.sh      # local (internal CA)
#   BASE_HOST=158.180.46.246.nip.io ./deploy/smoke.sh # remote (Let's Encrypt)
#
# -k tolerates the local internal-CA cert; remote Let's Encrypt certs are valid.
set -euo pipefail

BASE_HOST="${BASE_HOST:-127.0.0.1.nip.io}"
SUBS=(cms terminal pipboy)
fail=0

check() { # description, url, expected-substring
  local desc="$1" url="$2" needle="$3"
  local body code
  body="$(curl -sk -w '\n%{http_code}' "$url")" || { echo "FAIL  $desc  ($url unreachable)"; fail=1; return; }
  code="$(printf '%s' "$body" | tail -n1)"
  body="$(printf '%s' "$body" | sed '$d')"
  if [[ "$code" == "200" && "$body" == *"$needle"* ]]; then
    echo "OK    $desc  (HTTP $code)"
  else
    echo "FAIL  $desc  (HTTP $code, missing '$needle')"
    fail=1
  fi
}

echo "Smoke test against BASE_HOST=$BASE_HOST"
for sub in "${SUBS[@]}"; do
  check "$sub app HTML"        "https://$sub.$BASE_HOST/"              "<"
  check "$sub same-origin /api" "https://$sub.$BASE_HOST/api/campaigns" "["
done

if [[ "$fail" -ne 0 ]]; then
  echo "SMOKE FAILED"
  exit 1
fi
echo "SMOKE PASSED"
