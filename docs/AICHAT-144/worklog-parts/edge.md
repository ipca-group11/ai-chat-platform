### US12 · MFE remote mock: slow, missing and broken remotes ([AICHAT-158](https://ipca-grupo11.atlassian.net/browse/AICHAT-158))

**What and why.** The shell must keep working when a micro frontend is slow, missing or broken. The mock server now answers `GET /remotes/<name>/remoteEntry.js` and the name picks the behavior: `ok` returns a small Module Federation style container, `slow` waits (3000 ms by default, or `?delayMs=`, at most 60 s) and then answers like `ok`, `404` answers not found, and `broken-js` answers 200 with JavaScript that does not parse. The four names are also listed by `/__admin/scenarios`. A shell test loads a remote through `createRemoteRoute` and checks that `RemoteFallback` appears for `404` and `broken-js`, that the rest of the page stays, and that `ok` shows no fallback.

**Files.**
- `testing/mock-server/src/routers/remotes.router.ts` and `remotes.router.spec.ts`
- `apps/shell/src/features/remote-loader/mockRemotes.test.tsx`
- `testing/mock-server/src/app.spec.ts`: the "no scenarios" test now builds the app with an empty module list, because the remotes mock registers scenarios.

**How to run.**

```sh
pnpm exec nx test mock-server
pnpm exec nx test shell
```

**How to repeat it manually.**

1. Start the server: `pnpm exec nx serve mock-server`.
2. Run `curl -si localhost:4010/remotes/ok/remoteEntry.js` (and `404`, `broken-js` in place of `ok`).
3. Run `curl -s -o /dev/null -w '%{time_total}\n' 'localhost:4010/remotes/slow/remoteEntry.js?delayMs=2000'`; it prints about 2 seconds.
4. To see the fallback in the real shell, set `VITE_MFE_CHAT_URL=http://localhost:4010/remotes/404` in `apps/shell/.env.local` and open the chat route.

**Result.** `ok` answers 200 with the container, `slow` takes 2.0 s against 0.002 s for `ok`, `404` answers 404 and `broken-js` answers 200 with a script that Node refuses to parse. The shell test shows `RemoteFallback` for `404` and `broken-js`.

![ok remote](evidence/50-remote-ok.png)
![slow remote with timing](evidence/51-remote-slow.png)
![404 remote](evidence/52-remote-404.png)
![broken-js remote](evidence/53-remote-broken-js.png)
![shell RemoteFallback test](evidence/57-shell-remote-fallback-test.png)

**Problems and fixes.** The shell test uses a `fetch` stub that answers what the mock answers, so it needs no running server and does not make the shell depend on the mock-server package. Real `import()` of a federated remote is covered by the manual step above. The existing "no scenarios" test in `app.spec.ts` failed once the remotes mock registered scenarios, so it now passes an empty module list.

### US13 · Telemetry sink for Faro payloads ([AICHAT-159](https://ipca-grupo11.atlassian.net/browse/AICHAT-159))

**What and why.** The shell sends Grafana Faro telemetry to a collector. The mock accepts `POST /collect` with any JSON payload, answers 202 and answers the CORS preflight a browser sends. The payloads are kept by the request log of US14, so `GET /__admin/requests?mock=collect` returns them in arrival order and `/__admin/reset` empties them.

**Files.** `testing/mock-server/src/routers/collect.router.ts` and `collect.router.spec.ts`.

**How to run.**

```sh
pnpm exec nx test mock-server
```

**How to repeat it manually.**

1. Start the server and run `curl -X POST localhost:4010/collect -H 'content-type: application/json' -d '{"logs":[{"message":"page loaded"}]}'`; the answer is `{"status":"accepted"}` with HTTP 202.
2. Run `curl 'localhost:4010/__admin/requests?mock=collect'`; the payload is in `requests[0].body`.
3. To point the shell at it, set the Faro collector URL of the shell to `http://localhost:4010/collect`.

**Result.** The POST is accepted and the GET returns the stored payload with method, path, headers and status.

![Faro POST then GET](evidence/54-faro-post-get.png)

**Problems and fixes.** None. The sink has no store of its own, to keep one place where requests are kept and masked.

### US14 · Request inspection across all mocks ([AICHAT-150](https://ipca-grupo11.atlassian.net/browse/AICHAT-150))

**What and why.** Tests need to check what the app sent to the mocks without leaking secrets into logs and screenshots. A request log (`src/core/request-log.ts`) records every request to every mock (not the admin endpoints) with id, time, mock name, method, path, query, headers, body and response status. Values of `authorization`, `x-api-key`, `x-llm-api-key`, `cookie`, `set-cookie` are replaced by `***` before storing, and so are query and body fields whose name contains `key`, `token`, `password` or `secret`, at any depth. `GET /__admin/requests` lists the entries and `?mock=<name>` filters them. The log keeps the newest 1000 entries and `/__admin/reset` clears it. It is added with one line in `app.ts`, so the other mocks need no change; it also parses JSON bodies for all mocks, and answers 400 `invalid_json` for a body that does not parse.

**Files.**
- `testing/mock-server/src/core/request-log.ts` and `request-log.spec.ts`
- `testing/mock-server/src/app.ts` (log created and applied to each mock)
- `testing/mock-server/src/admin/admin.router.ts` (`GET /requests`)

**How to run.**

```sh
pnpm exec nx test mock-server
```

**How to repeat it manually.**

1. Start the server and send `curl -X POST localhost:4010/remotes/ok/remoteEntry.js -H 'authorization: Bearer sk-secret' -H 'x-api-key: sk-ant-123' -H 'cookie: session=abc' -H 'content-type: application/json' -d '{"user":"ana","password":"hunter2"}'`.
2. Run `curl 'localhost:4010/__admin/requests?mock=remotes'`; the secrets show as `***`, `user` is intact.
3. Run `curl -X POST localhost:4010/__admin/reset`, then the GET again; the list is empty.

**Result.** Headers and body fields are masked, the filter works and the reset empties the log. The mock-server suite has 77 tests, with 99.6% statements and 100% lines.

![Masked request log and reset](evidence/55-masked-request-log.png)
![mock-server tests](evidence/56-mock-server-tests.png)

**Problems and fixes.** The log needs the parsed body, so the JSON parser runs before the mock routers; the parser skips a body that is already parsed, so routers that call `express.json()` themselves still work. The log is written when the request arrives and the status is filled in when the response finishes, so a slow request is already listed while it waits.
