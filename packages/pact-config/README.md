# `@platform/pact-config`

Shared Pact.js scaffolding (US-29/US-30, AC-95). Configures every consumer test and every
service's provider-verification step identically; does **not** author any pod's actual
contract tests — those live in each domain pod's own `apps/mfe-*`/`services/*`.

## What's in here

- `pact.config.ts` — `PACT_DIR` (`./pacts`), `PACT_LOG_LEVEL`, the
  `PACT_BROKER_URL`/`PACT_BROKER_TOKEN` env var names, `consumerName`/`providerName`
  (naming convention helpers), `pactConsumerOptions(consumer, provider)`, and
  `pactBrokerConfig()`.
- `matchers.ts` — re-exports `like`/`eachLike`/`term` (Pact V3's `like`/`eachLike`/`regex`,
  the last kept under its more readable V2 name) plus shared matchers for the common
  envelope shapes: `correlationHeaderMatcher()` (the `X-Correlation-Id` response header,
  `STACK.md` decision #8) and `errorResponseMatcher()`/`fieldErrorsMatcher()` (the uniform
  `{ error: { code, message, fieldErrors? } }` body every non-2xx response returns, mirroring
  `packages/shared-types`'s `errorResponseSchema`).

## Convention: where contract tests live

- **Consumer tests** live next to the feature that makes the call, e.g.
  `apps/mfe-auth/src/features/login/api/login.pact.spec.ts`, using
  `new PactV3(pactConsumerOptions("auth", "auth"))` (`@pact-foundation/pact`'s `PactV3`)
  plus this package's matchers to define expected interactions, generating a contract file
  under `PACT_DIR` (`./pacts`).
- **Provider verification** lives in the service's own test target, e.g. a dedicated
  `services/auth-service`'s `verify-contracts` Nx target (or folded into its `test`
  target), running `@pact-foundation/pact`'s `Verifier` against the same `pactConsumerOptions`
  naming so it picks up the matching `<consumer>-<provider>.json` file.
- Both sides are owned and authored by the domain pod on each side of the contract
  (`auth`, `chat`, `settings`) — this package only provides the shared config/matchers
  convention both sides configure identically against.

## Naming convention

`consumerName("auth")` -> `"mfe-auth"`, `providerName("auth")` -> `"auth-service"` (both are
idempotent if already prefixed/suffixed). This keeps generated `pacts/mfe-auth-auth-service.json`
file names and Pact Broker application names predictable across every pod.

## Optional local Pact Broker

For teams wanting contract verification enforced in CI beyond local file-based pacts, add
the `pactfoundation/pact-broker` Docker image as a service in `compose.yaml` and set
`PACT_BROKER_URL`/`PACT_BROKER_TOKEN` in CI. This is **not** wired up by this package —
`compose.yaml` is `platform-foundation`-owned, so this is proposed as a PR to that
pod rather than edited here directly (see this pod's PLAN.md, task O5 and "Cross-pod
dependencies"). Until then, `pactBrokerConfig()` returns `undefined` and contract tests run
against local files only.

## Example (consumer)

```ts
import { PactV3 } from "@pact-foundation/pact";
import { pactConsumerOptions, like, errorResponseMatcher } from "@platform/pact-config";

const provider = new PactV3(pactConsumerOptions("auth", "auth"));

provider
  .given("no user with this email exists")
  .uponReceiving("a register request")
  .withRequest({ method: "POST", path: "/auth/register", body: { ... } })
  .willRespondWith({ status: 201, body: { id: like("user-1") } });
```
