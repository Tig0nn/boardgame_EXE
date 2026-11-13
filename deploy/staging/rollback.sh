#!/bin/sh
set -eu

env_file=${1:?Usage: sh rollback.sh /path/to/staging.env previous-release https://approved-staging-host}
previous=${2:?Set the previous local release tag}
origin=${3:?Set the approved staging HTTPS origin}
case "$previous" in
  ''|*[!a-zA-Z0-9_.-]*) printf '%s\n' 'Invalid release tag.' >&2; exit 1 ;;
esac
case "$origin" in
  https://*) ;;
  *) printf '%s\n' 'An HTTPS origin is required.' >&2; exit 1 ;;
esac
authority=${origin#https://}
hostname=${authority%%:*}
case "$hostname" in
  ''|*[!a-zA-Z0-9.-]*) printf '%s\n' 'Invalid staging hostname.' >&2; exit 1 ;;
esac
if [ "$authority" != "$hostname" ]; then
  case "${authority#*:}" in
    ''|*[!0-9]*) printf '%s\n' 'Invalid HTTPS port.' >&2; exit 1 ;;
  esac
fi

directory=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
export EXE_RELEASE="$previous"
compose() { docker compose --env-file "$env_file" -f "$directory/compose.yaml" "$@"; }
running_edge=$(compose ps -q edge)
[ -n "$running_edge" ]
running_hostname=$(docker exec "$running_edge" printenv EXE_STAGING_HOSTNAME)
[ "$running_hostname" = "$hostname" ] || {
  printf '%s\n' 'Origin differs from the running staging hostname.' >&2
  exit 1
}
export EXE_STAGING_HOSTNAME="$running_hostname"
for image in "exe-staging-api:$previous" "exe-staging-edge:$previous"; do
  docker image inspect "$image" > /dev/null
done
compose up -d --no-build --pull never api edge
sh "$directory/health.sh" "$origin"
