#!/usr/bin/env bash
set -euo pipefail
deploy() {
umask 077
cd "$(dirname -- "${BASH_SOURCE[0]}")/.."
test -f .env || { echo "Missing production .env"; exit 1; }
set -a
source .env
set +a
test "$(git remote get-url origin)" = "https://github.com/Akezhan7/packera.git" || { echo "Unexpected origin"; exit 1; }
git diff --quiet && git diff --cached --quiet || { echo "Uncommitted changes; deployment refused"; exit 1; }
mkdir -p "$PACKERA_DATA_DIR"
exec 9>"$PACKERA_DATA_DIR/deploy.lock"
flock -n 9 || { echo "Another deployment is running"; exit 1; }
git fetch origin
target=$(git rev-parse --verify "${1:-origin/main}^{commit}")
previous=$(docker inspect --format '{{.Config.Image}}' packera_app 2>/dev/null || true)
git checkout --detach "$target"
export APP_IMAGE="packera:$target"
docker compose build app
if docker inspect packera_db >/dev/null 2>&1; then bash backup.sh; fi
docker compose up -d --wait --wait-timeout 150
awk -v image="$APP_IMAGE" '/^APP_IMAGE=/{print "APP_IMAGE=" image; next} {print}' .env > .env.next
mv .env.next .env
printf 'Deployed commit: %s\nPrevious image: %s\n' "$target" "$previous"
}
deploy "$@"
