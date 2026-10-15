# ai-chat-platform

## Dependency scanning

`pnpm audit --audit-level=high` runs in CI and must stay clean; see [docs/AICHAT-6](docs/AICHAT-6/README.md).

The deploy workflow scans every image with Trivy before pushing it; HIGH+ findings block the deploy. See [docs/AICHAT-7](docs/AICHAT-7/README.md).
