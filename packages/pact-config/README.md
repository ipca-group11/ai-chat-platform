# `@platform/pact-config`

Shared Pact setup for the consumer-driven contract tests (AICHAT-11). Every consumer test and every provider verification
uses these helpers, so the pact folder, naming and matchers are the same everywhere. The tests themselves live next to
the code they cover in each app and service.

## How it fits together

```
consumer (apps/*, auth-service)                         provider (services/*)
  *.pact.spec.ts                                          src/contract/provider.verify.spec.ts
  real API function ──▶ Pact mock server                  Pact Verifier ──▶ real Express app (in-memory fakes)
            │                                                   ▲   state handlers seed each `given(...)`
            ▼                                                   │   requestFilter adds cookie / service token
  pacts/<consumer>-<provider>.json  ── CI artifact "pacts" ─────┘
```

| Pair | Consumer test | Provider verifier |
|---|---|---|
| mfe-auth, shell, mfe-settings, mfe-chat → auth-service | `apps/*/src/**/*.pact.spec.ts` | `services/auth-service/src/contract/provider.verify.spec.ts` |
| mfe-chat, mfe-settings → conversation-service | `apps/*/src/**/*.pact.spec.ts` | `services/conversation-service/src/contract/provider.verify.spec.ts` |
| auth-service → conversation-service (`/internal/*`) | `services/auth-service/src/shared/internal-clients.pact.spec.ts` | same as above |

`GET /chats/:id/stream` (SSE) is not request/response and has no pact (see AICHAT-12).

## Running

```sh
pnpm exec nx run-many -t pact:consumer          # writes pacts/ at the repo root (git-ignored)
pnpm exec nx run auth-service:pact:verify
pnpm exec nx run conversation-service:pact:verify
```

Order matters: the verifiers read `pacts/` and fail with "no pact files … run the consumer tests first" when it is empty.
In CI (`.github/workflows/ci.yml`) the job `contracts-consumer` runs every consumer and uploads `pacts/` as the artifact
`pacts`; `contracts-provider` downloads it and verifies both services. Both jobs run on every pull request; a failure on
either side fails the pull request. No Pact Broker is used (decision in AICHAT-177).

## What's in here

- `consumer.ts`
  - `newConsumerPact(consumer, provider)`: a `PactV3` writing `<consumer>-<provider>.json` into `pactDir()`.
  - `runWithMockServer(pact, fn, { stripPrefix })`: runs `fn` (the real client code) with the global `fetch` pointed at
    the mock server; `stripPrefix: "/api"` mirrors the shell proxy. If `fn` rejects on purpose (a 401 the client turns
    into an error), the interaction is still written and the rejection is passed on.
  - `removePacts(consumer)`: called from each app's `vitest.pact.setup.ts`, so every run starts from an empty file.
  - `pactDir()`, `routeFetchTo()`: the pieces underneath.
- `provider.ts`
  - `pactFilesFor(provider)`: every pact for a provider; throws when there is none.
  - `splitKnownFailures(files, knownFailures, dir)`: interactions of tracked defects are verified on their own and must
    keep failing; everything else must pass. A fixed defect turns the run red until its entry is removed.
- `matchers.ts`: `like`, `eachLike`, `boolean`, `term` (regex), `correlationHeaderMatcher()`, `errorResponseMatcher()`
  and `fieldErrorsMatcher()` for the `{ error: { code, message, fieldErrors? } }` envelope both services send.
- `pact.config.ts`: `PACT_DIR`, `PACT_LOG_LEVEL`, naming helpers, broker env names (unused: no broker).

## Adding a contract

1. **Consumer.** Next to the API function, create `<name>.pact.spec.ts`. Declare the provider state, the exact request
   and only the response fields the client reads, using matchers for values:

   ```ts
   const pact = newConsumerPact("mfe-chat", "conversation-service");

   pact
     .given("a user owns a chat", { chatId: "chat-1" })
     .uponReceiving("a request to stop the reply in progress")
     .withRequest({ method: "POST", path: "/chats/chat-1/stop", headers: { "X-Correlation-Id": correlationHeaderMatcher() } })
     .willRespondWith({ status: 200, body: { stopped: boolean(true) } });

   await expect(runWithMockServer(pact, () => stopReply("chat-1"), { stripPrefix: "/api" })).resolves.toEqual({ stopped: true });
   ```

   Call the real function, never a hand-written `fetch`. Leave cookies and tokens out: they are not part of the contract.
2. **Provider.** If the state is new, add a handler to the provider's `stateHandlers` that builds a fresh app and seeds
   it (fixed ids such as `chat-1` through the fakes' `seed()`). Run `pact:verify`.
3. **A provider defect you cannot fix now.** Raise a Jira issue and add the interaction to `KNOWN_FAILURES` in the
   provider's verifier, with the issue key. Remove it in the change that fixes the defect.

## Reading a failure

- Consumer test: `Mock server failed with the following mismatches … request was not expected` means the client sent a
  request the pact does not declare (path, method, header or body differs).
- Verifier: `Verifying a pact between <consumer> and <provider> Given <state> - <description>` names the consumer that
  would break, followed by the mismatch, for example `$ -> Actual map is missing the following keys: id`.
