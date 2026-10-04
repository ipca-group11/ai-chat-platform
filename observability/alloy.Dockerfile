# Bakes the Alloy pipeline (Faro receiver -> Loki) into the image instead of a bind mount
# (compose.yaml forbids bind mounts). Build context is the repo root:
#   docker build -f observability/alloy.Dockerfile .
FROM grafana/alloy:v1.20.1
COPY observability/alloy.alloy /etc/alloy/config.alloy
# Upstream image sets its own user; adding USER risks volume permissions (WAIVERS.md W4)
# nosemgrep: missing-user
CMD ["run", "--server.http.listen-addr=0.0.0.0:12345", "--storage.path=/var/lib/alloy/data", "--disable-reporting", "/etc/alloy/config.alloy"]
