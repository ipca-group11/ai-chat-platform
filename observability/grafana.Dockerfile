# Bakes datasource/dashboard provisioning into the Grafana image instead of a bind mount
# (compose.yaml forbids bind mounts). Build context is the repo root:
#   docker build -f observability/grafana.Dockerfile .
FROM grafana/grafana:latest
COPY observability/grafana/provisioning /etc/grafana/provisioning
