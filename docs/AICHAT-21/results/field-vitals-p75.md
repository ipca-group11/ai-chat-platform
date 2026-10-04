# Real-user Web Vitals p75 per page (local stack, not the VM)

Source: the "Web Vitals by page (Grafana Faro)" dashboard, range "Last 1 hour", after `scripts/perf/field-visits.ts`
(6 rounds of the 5 pages in headless Chrome, fresh browser context per visit). Values are what Chrome measured and
Faro sent to Loki.

| Page | LCP p75 | INP p75 | CLS p75 | LCP samples |
|---|---|---|---|---|
| `/login` | 650 ms | 46 ms | 0.0000 | 6 |
| `/register` | 632 ms | 62 ms | 0.0000 | 6 |
| `/chats` | 676 ms | 48 ms | 0.0000 | 6 |
| `/chats/:id` | 747 ms | 54 ms | 0.0000 | 6 |
| `/settings` | 658 ms | 56 ms | 0.0000 | 6 |
