# Project: Multi-Session AI Chat Platform

## 1. Overview
Build an end-to-end web application that lets authenticated users chat with Large Language
Models (Ollama, OpenAI ChatGPT, Anthropic Claude) through a backend conversation service.
Users can run multiple chat sessions in parallel, receive responses as a live stream,
queue messages, and attach files. Users enter their own LLM API keys manually on a
configuration page.

The system is split into end-to-end business domains (auth, chat, configuration). Each
domain is a vertical slice with its own microfrontend and, where it needs a backend, its
own microservice. Everything lives in a single monorepo.

## 2. Tech Stack (mandatory)
- Language: TypeScript 7.0.2 (frontend and backend)
- Runtime: Node.js 26.x
- Package manager: pnpm (pnpm workspaces)
- Monorepo tooling: Nx (project graph, cached tasks, `nx affected` in CI)
- Frontend: React 19.x
- Bundler: Vite (for every frontend app and library)
- Microfrontends: Vite Module Federation (`@module-federation/vite`), with a host
  (shell) app loading one remote per domain
- Routing: TanStack Router (type-safe, file-based routes)
- Server state: TanStack Query
- UI Library: shadcn/ui on Base UI primitives (not Radix), styled with Tailwind
- Typography: follow shadcn Typeset (https://ui.shadcn.com/docs/typeset)
- Design system: shared component library documented in Storybook
- Static analysis: ESLint (flat config with typescript-eslint) for linting, and `tsc`
  type checking with no emit, as Nx targets on every project
- Backend Framework: Express
- Database: Postgres
- ORM: Prisma
- Test tools: Playwright, Vitest, Axe, Pact, K6
- Containerization: Docker, with Docker Compose orchestrating all services for local
  development (a single `docker compose up` must start the whole system, including Ollama)
- Observability: Prometheus and Grafana

## 3. Architecture

### 3.1 Domains (vertical slices)
| Domain        | Microfrontend    | Microservice           |
|---------------|------------------|------------------------|
| Auth          | `mfe-auth`       | `auth-service`         |
| Chat          | `mfe-chat`       | `conversation-service` |
| Configuration | `mfe-settings`   | none (keys stay in the browser, see FR17–FR20) |

1. **Shell (host app)**: owns the app layout, top-level TanStack Router routes, the
   shared TanStack Query client, and the auth guard. It lazy-loads each domain's
   microfrontend at runtime through Module Federation. React, React DOM, TanStack Router,
   TanStack Query, and the design system are shared as singletons.
2. **Auth microfrontend**: registration, login, and logout screens.
3. **Chat microfrontend**: chat list, chat view, message composer, queue, attachments.
4. **Settings microfrontend**: the configuration page for LLM API keys.
5. **Auth Service**: user registration, login, logout, and token issuing/validation.
6. **Conversation Service**: owns chats and messages, runs each chat's message queue,
   handles file uploads, and streams LLM responses to the client.
7. **LLM Provider Adapter layer** (inside the Conversation Service): one common interface
   with three implementations: Ollama, OpenAI (ChatGPT), and Anthropic (Claude). Adding a
   new provider must not require changes outside this layer.
8. **Persistence**: a database for users, chats, and messages

Services communicate over HTTP. The Conversation Service must validate the user's
identity on every request, using tokens issued by the Auth Service. Microfrontends never
import each other directly; they communicate only through routes, shared libraries, and
the backend APIs.

### 3.2 Monorepo layout (Nx + pnpm)
```
apps/
  shell/                  # host app (Vite + Module Federation host)
  mfe-auth/               # remote
  mfe-chat/               # remote
  mfe-settings/           # remote
services/
  auth-service/
  conversation-service/
packages/
  ui/                     # design system (shadcn on Base UI + Tailwind + Storybook)
  shared-types/           # API contracts and DTOs shared by frontends and services
  eslint-config/          # shared ESLint flat config
  tsconfig/               # shared tsconfig bases
```
Every project defines Nx targets for `lint`, `typecheck`, `test`, and `build` (frontends
also `serve`; `packages/ui` also `storybook`). Module boundaries are enforced with Nx tags
(for example, an app may depend on `packages/*` but never on another app).

### 3.3 Feature-based architecture
Inside every app and service, code is organized by feature, not by technical layer:
```
src/
  features/
    <feature>/            # e.g. chat-list, composer, message-queue, api-keys
      components/
      hooks/
      api/                # TanStack Query hooks (frontend) or routes/controllers (backend)
      model/              # types, schemas, business logic
      index.ts            # the feature's public API; other features import only this
  shared/                 # code used by several features in the same app
```
A feature may import from `shared/` and from other features' `index.ts` only, never from
their internals.

### 3.4 Design system (`packages/ui`)
- Built from shadcn/ui components on Base UI primitives, themed with Tailwind design
  tokens (colors, spacing, radius, typography) and supporting light and dark mode.
- Typography follows shadcn Typeset.
- Includes at least: Button, Input, Textarea, Label, Form field, Card, Dialog, Dropdown
  menu, Select, Tabs, Toast, Badge, Avatar, Skeleton, Tooltip, and typography components.
- Every component has Storybook stories covering its variants and states, with the
  Storybook accessibility (Axe) addon enabled.
- All microfrontends use only design-system components for UI primitives.

## 4. Functional Requirements

### Authentication
- FR1: A user can register with an email and password. Email must be unique and
  passwords must be stored hashed.
- FR2: A user can log in with the credentials they registered with, and log out.
- FR3: Every chat and configuration feature requires an authenticated session.
  Unauthenticated users are redirected to the login page.

### Chats and Sessions
- FR4: A user can create, list, rename, open, and delete chats.
- FR5: Chats are scoped to their owner. A user can never read, modify, or stream from
  another user's chat (enforced on the server, not just hidden in the UI).
- FR6: The user chooses the LLM provider and model for each chat.
- FR7: A user can have several chats generating responses at the same time. Switching
  between chats must not interrupt or lose any in-progress stream.
- FR8: Chat history is saved and restored after a page reload or a new login.

### Messaging
- FR9: A user can write and send a text message and receive the LLM's response.
- FR10: Responses are streamed token by token and rendered as they arrive (suggested:
  Server-Sent Events). The user can stop a response mid-stream.
- FR11: Message queue: while a chat is waiting for or streaming a response, the user can
  keep sending messages. They are added to that chat's queue (first in, first out) and
  processed one at a time in order. Queued messages are shown with a "queued" state, and
  the user can edit or cancel them before processing starts.
- FR12: The full conversation history of the chat is sent to the LLM as context.

### File Attachments
- FR13: A user can attach one or more files to a message.
- FR14: Allowed types are .txt, .pdf, .png, and .jpeg/.jpg only. Validate both the file
  extension and the MIME type, on the client and on the server.
- FR15: Enforce a maximum file size (suggested: 10 MB per file) and reject files that are
  too large or of the wrong type with a clear message.
- FR16: Attachments are passed to the LLM in a way each provider supports (text/PDF
  content extracted as text, images sent as image input when the model supports vision).
  If the selected model cannot handle an attachment type, tell the user.

### Configuration (API keys)
- FR17: A configuration page (in `mfe-settings`, reachable from the app navigation) lets
  the user manually enter, update, and remove an API key for each provider that needs
  one (OpenAI and Anthropic; Ollama needs no key).
- FR18: API keys are stored only in the user's browser (for example, localStorage),
  scoped to the logged-in user. They are never saved in the database, on disk, or in
  server logs.
- FR19: The browser sends the relevant key with each request that calls an LLM (for
  example, in a request header). The Conversation Service uses it only for that request.
- FR20: Saved keys are shown masked (for example, `sk-…a1b2`), with a "Test connection"
  action that checks the key against the provider and shows the result. If a user sends
  a message to a provider without a configured key, the chat shows a clear message with
  a link to the configuration page.

## 5. Use Cases (with acceptance criteria)
- UC1 Register: Given a new email and a valid password, when the user submits the
  registration form, then an account is created and they can log in. A duplicate email
  or an invalid password shows a validation error.
- UC2 Login: Given registered credentials, when the user logs in, then they reach their
  chat list. Invalid credentials show a generic error that does not reveal which field
  was wrong.
- UC3 Send and receive a message: Given an open chat, when the user sends a message,
  then the response streams into the chat incrementally and is saved when complete.
- UC4 Queue messages: Given a chat that is currently streaming, when the user sends two
  more messages, then both appear as queued and are answered in order after the
  current response finishes.
- UC5 Attach a file: Given an open chat, when the user attaches a valid .txt, .pdf, .png,
  or .jpeg file and sends it, then the LLM's response takes the file into account. An
  invalid type or size is rejected before upload.
- UC6 Parallel sessions: Given two or more chats, when the user sends messages in each
  and switches between them, then all responses stream at the same time and complete
  correctly.
- UC7 Isolation: Given user A's chat ID, when user B requests it, then the API returns
  403/404.
- UC8 Configure an API key: Given a logged-in user on the configuration page, when they
  enter a valid key for a provider and save it, then the key is shown masked, "Test
  connection" succeeds, and chats using that provider work. An invalid key shows a clear
  error, and removing the key makes that provider's chats ask for a key again.

## 6. Non-Functional Requirements
- Security: LLM API keys are provided by the user and kept only in the browser; the
  server receives them per request over HTTPS, never persists or logs them, and redacts
  them from errors. The UI never displays a saved key in full. The team accepts that
  browser-stored keys are exposed to XSS, so a strict Content Security Policy and input
  sanitization are required. Validate all input. Auth tokens are stored securely
  (suggested: httpOnly cookies).
- Reliability: Provider errors, timeouts, and rate limits are shown to the user
  without crashing the chat, and the user can retry. A failed queued message does not
  block the rest of the queue. If a microfrontend fails to load, the shell shows an error
  state for that area and the rest of the app keeps working.
- Performance: The first token appears in the UI within about 1 second of the provider
  emitting it. The UI stays responsive with at least 5 chats streaming at once.
- Configuration: All service and infrastructure configuration is done through
  environment variables, with a `.env.example` file provided. LLM API keys are the
  exception: they come only from the configuration page.
- Code quality: `lint` and `typecheck` must pass with zero errors on every project, and
  run in CI with `nx affected`.
- Observability: Structured logs with a correlation ID for each request.
- Testability: Unit tests for business logic and the provider adapters (with LLMs
  mocked), integration tests for the service APIs, Storybook stories for the design
  system, and end-to-end tests covering UC1–UC8. Define a testing strategy and coverage
  targets.

## 7. Out of Scope (for now)
Password reset, OAuth/social login, sharing chats between users, admin panel,
billing/usage quotas, server-side storage of API keys, and deployment to production.

## 8. Open Questions (resolve with me before finalizing the spec; do not assume)
1. Can a user change a chat's LLM provider/model mid-conversation, or is it fixed when
   the chat is created?
2. Should queued messages be kept if the user closes the browser before they are
   processed?
3. Is there a limit on concurrent chats per user, or on overall LLM request rate?
4. Do file uploads need to be kept long term, or only for the duration of the request?
5. Should the frontend call both services directly, or go through an API gateway /
   reverse proxy?
6. Should the configuration page also let the user set the Ollama base URL, or a
   default provider/model for new chats?
