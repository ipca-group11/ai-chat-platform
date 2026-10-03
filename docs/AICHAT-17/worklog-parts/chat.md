### US6 · mfe-chat: unit tests for hooks, API client and SSE ([AICHAT-87](https://ipca-grupo11.atlassian.net/browse/AICHAT-87))

**What and why.** The hooks and the HTTP/SSE plumbing of `mfe-chat` carry every request the chat makes, but only their callers were tested. We added a test next to each file: `use-media-query`, `useUploadAttachment`, `useMessageQueue`, `api-client`, `auth`, `sse`, plus the two indirect files with their own logic (`chat-members/api/members.ts`, `app/auth-context.tsx`). While there we also covered the small modules that had no test (`query-keys`, `types`, `show-reasoning`), because the policy has no exemption for them. HTTP goes through the shared MSW server (`server.use(...)` for the error cases), SSE through `FakeEventSource`.

**Files.** `app/use-media-query.test.ts`, `app/auth-context.test.tsx`, `features/attachments/api/useUploadAttachment.test.ts`, `features/message-queue/hooks/useMessageQueue.test.tsx`, `features/chat-members/api/members.test.tsx`, `features/chat-view/model/show-reasoning.test.ts`, `shared/{api-client,auth,sse,query-keys,types}.test.ts` (all under `apps/mfe-chat/src`).

**How to run.** `pnpm exec nx run mfe-chat:test` (or `cd apps/mfe-chat && pnpm exec vitest run <file>`).

**How to repeat it manually.** Run the command above. To see an error path fail, change a status in `api-client.ts` (for example stop reading `payload.message`) and run `api-client.test.ts`.

**Result.** The API client is checked for the `/api` base, credentials, a new correlation id per call, JSON versus `FormData` bodies, the `X-Llm-Api-Key` header (only on opt-in and only when a key exists), the single-key envelope, 204, JSON and non-JSON error bodies and network failure. The SSE test separates provider `error` events from dropped connections and shows the same connection stays open after a transport error, so the browser can reconnect.

![](evidence/40-chat-us6-hooks-api-sse.png)

**Problems and fixes.** jsdom's `FormData` and `File` are not the classes Node's `fetch` understands, so an upload built from them failed before reaching MSW. The upload test swaps in Node's `FormData` and `File` and reads the raw multipart body in the handler. `@app/ui` must be built before the tests run (`nx` does it as a dependency); a bare `vitest` run on a fresh checkout fails to resolve it.

### US7 · mfe-chat: render-level tests for untested components and pages ([AICHAT-126](https://ipca-grupo11.atlassian.net/browse/AICHAT-126))

**What and why.** The chat pages and several components were only exercised indirectly or not at all. Each now has a render test that checks props, the main interaction and accessible names (queries by role and label). `WebFetchList` is tested against model-supplied URLs: only `http:` and `https:` become links, while `javascript:`, `data:`, `file:`, `ftp:` and text that is not a URL show as plain text.

**Files.** `app/{ChatWorkspace,ChatListPage,ChatDetailPage}.test.tsx`, `features/chat-view/components/{MessageBubble,ReasoningSection,WebFetchList}.test.tsx`, `features/message-queue/components/QueuedMessageItem.test.tsx`.

**How to run.** `pnpm exec nx run mfe-chat:test`.

**How to repeat it manually.** Open a chat in the app with a model that fetches pages; the list of pages appears under the reply. In `WebFetchList.test.tsx`, change `isWebUrl` to accept any protocol and the `javascript:` cases fail.

**Result.** The workspace tests cover the empty state, opening a chat from the URL, swapping and splitting panes, the layout toggle, focus moving between panes (not through the close button), closing the pane of a deleted chat, and the small-screen back button. The coverage exclude of `mfe-chat` already lists only `src/app/remote-entry.tsx` (the Module Federation mount, which wires `createRoot` and has no logic of its own); nothing else in `src/app` is excluded.

![](evidence/41-chat-us7-components.png)

**Problems and fixes.** The first workspace harness read the route param outside React and did not re-render; mounting the real `ChatListPage` and `ChatDetailPage` as route components fixed it and also covers both pages. The `scrollTo` "not implemented" lines in the output come from jsdom and are harmless.

### US8 · mfe-chat: table-driven tests for model capability tables ([AICHAT-129](https://ipca-grupo11.atlassian.net/browse/AICHAT-129))

**What and why.** The capability tests asserted a handful of models by hand. `shared/model-capability-tables.test.ts` walks every `PROVIDER_MODELS` entry with `it.each` and checks reasoning, web fetch, vision, text and pdf against an explicit expectation row. A model without a row fails, and so does a row for a model that no longer exists, so a new model cannot be added with an unchecked capability. The three imports at the top of the file are the only lines to repoint when the table moves to `packages/shared-types`.

**Files.** `apps/mfe-chat/src/shared/model-capability-tables.test.ts`.

**How to run.** `cd apps/mfe-chat && pnpm exec vitest run src/shared/model-capability-tables.test.ts`.

**How to repeat it manually.** Add `"gpt-6"` to `PROVIDER_MODELS.openai` in `shared/types.ts` and run the command: four tests fail until a row is added.

**Result.** 55 tests pass for the ten current models. Adding a model without a row fails:

![](evidence/42-chat-us8-capability-tables.png)

![](evidence/43-chat-us8-missing-model-fails.png)

Coverage of `mfe-chat` went from 89.87 / 85.05 / 89.71 / 91.86 (statements / branches / functions / lines, 24 test files, 122 tests) to 94.37 / 89.50 / 93.24 / 96.01 (43 files, 313 tests).

![](evidence/44-chat-coverage.png)

![](evidence/45-chat-gate.png)

![](evidence/46-chat-sast.png)

**Problems and fixes.** `MembersDialog.test.tsx` (an existing test) timed out once when `nx` ran lint, typecheck, test and build in parallel and passed on every rerun; `nx` marks `mfe-chat:test` as flaky. Its `findByText` uses the default one second wait and should get a longer one. `supportsAttachmentKind` compares model names case-sensitively while the reasoning and web fetch checks lower-case them; the table test pins today's behaviour.
