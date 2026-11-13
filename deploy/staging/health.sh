#!/bin/sh
set -eu

origin=${1:?Usage: sh health.sh https://approved-staging-host}
case "$origin" in
  https://*) ;;
  *) printf '%s\n' 'An HTTPS origin is required.' >&2; exit 1 ;;
esac
authority=${origin#https://}
hostname=${authority%%:*}
case "$hostname" in
  ''|*[!a-zA-Z0-9.-]*) printf '%s\n' 'Invalid HTTPS hostname.' >&2; exit 1 ;;
esac
if [ "$authority" != "$hostname" ]; then
  case "${authority#*:}" in
    ''|*[!0-9]*) printf '%s\n' 'Invalid HTTPS port.' >&2; exit 1 ;;
  esac
fi

body=$(mktemp)
trap 'rm -f "$body"' EXIT
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl --fail --silent --max-time 8 "$origin/health" > "$body" &&
    grep -q '"status":"ok"' "$body" &&
    curl --fail --silent --max-time 8 "$origin/ready" > "$body" &&
    grep -q '"status":"ready"' "$body"; then
    break
  fi
  if [ "$attempt" = 10 ]; then
    printf '%s\n' 'HTTPS liveness or database readiness failed.' >&2
    exit 1
  fi
  sleep 3
done

curl --fail --silent --show-error --max-time 8 "$origin/" > "$body"
grep -q 'id="root"' "$body"
asset=$(sed -n 's/.*src="\(\/assets\/[^"]*\.js\)".*/\1/p' "$body" | head -n 1)
[ -n "$asset" ]
curl --fail --silent --show-error --max-time 8 "$origin$asset" > /dev/null
status=$(curl --silent --show-error --max-time 8 --output "$body" --write-out '%{http_code}' "$origin/v1/game-sessions")
[ "$status" = 401 ]
grep -q '"UNAUTHORIZED"' "$body"
printf '%s\n' 'HTTPS, Mobile assets, API liveness, database readiness and Auth guard passed.'
