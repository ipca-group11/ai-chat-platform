#!/bin/sh
# Validates the observability configs. Exits non-zero if either check fails.
#   promtool check config  -> prometheus.yml
#   loki -verify-config    -> loki.yml
set -u
dir=$(cd "$(dirname "$0")" && pwd)
prom_img=prom/prometheus:v2.55.1
loki_img=$(sed -n 's/^FROM \(grafana\/loki:[^ ]*\).*/\1/p' "$dir/loki.Dockerfile")
fail=0

docker run --rm -v "$dir:/c:ro" --entrypoint promtool "$prom_img" check config /c/prometheus.yml || fail=1
docker run --rm -v "$dir:/c:ro" "$loki_img" -config.file=/c/loki.yml -verify-config || fail=1

echo "observability config check exit code: $fail"
exit "$fail"
