#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Build and run Movbox on this machine. Run it on the Oracle box:
#
#   cd /opt/movbox && ./deploy/deploy.sh
#
# It pulls the latest main from GitHub, rebuilds the image and restarts the
# containers. Safe to run repeatedly — that is the whole deploy pipeline.
#
# First run only:
#   cp deploy/env.example .env      # then fill in the values
# ---------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"

echo "==> repo: $APP_DIR"
echo "==> branch: $(git rev-parse --abbrev-ref HEAD)  @ $(git rev-parse --short HEAD)"

if [ ! -f .env ]; then
  echo "!! .env is missing. Create it from deploy/env.example first:" >&2
  echo "   cp deploy/env.example .env && vi .env" >&2
  exit 1
fi

echo "==> pulling"
git pull --ff-only origin main

echo "==> building the image (this runs the sitemap prebuild: ~600 upstream calls, a few minutes)"
docker compose -f deploy/docker-compose.yml build

echo "==> starting"
docker compose -f deploy/docker-compose.yml up -d

echo "==> waiting for the app to answer"
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:3000/ 2>/dev/null; then
    echo "    app is up"
    break
  fi
  sleep 2
done

docker compose -f deploy/docker-compose.yml ps

echo
echo "==> local checks"
curl -s -o /dev/null -w "    /            %{http_code}  %{size_download} bytes\n" http://127.0.0.1:3000/
curl -s -o /dev/null -w "    /sitemap.xml %{http_code}  %{size_download} bytes\n" http://127.0.0.1:3000/sitemap.xml
curl -s -o /dev/null -w "    /movies      %{http_code}  %{size_download} bytes\n" http://127.0.0.1:3000/movies
echo
echo "done. the public site is only live once the Cloudflare DNS points here."
