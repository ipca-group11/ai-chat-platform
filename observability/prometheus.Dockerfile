# Bakes the scrape config into the Prometheus image instead of a bind mount (compose.yaml
# forbids bind mounts). Build context is the repo root:
#   docker build -f observability/prometheus.Dockerfile .
FROM prom/prometheus:latest
COPY observability/prometheus.yml /etc/prometheus/prometheus.yml
