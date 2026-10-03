# k6 with the xk6-sse extension (AICHAT-24): `k6/x/sse` reads a Server-Sent Events stream event
# by event, which the built-in http module cannot do, so time to first token can be measured.
#   docker build -t ai-chat-k6-sse -f testing/k6/Dockerfile testing/k6
FROM grafana/xk6:latest AS build
RUN xk6 build --with github.com/phymbert/xk6-sse@latest --output /tmp/k6

FROM grafana/k6:latest
COPY --from=build /tmp/k6 /usr/bin/k6
