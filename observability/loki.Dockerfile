# Bakes the Loki config into the image instead of a bind mount (compose.yaml forbids bind
# mounts). Build context is the repo root:
#   docker build -f observability/loki.Dockerfile .
FROM grafana/loki:3.7.8
COPY observability/loki.yml /etc/loki/config.yml
CMD ["-config.file=/etc/loki/config.yml"]
