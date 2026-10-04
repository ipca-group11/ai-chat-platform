import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { within, type Matcher } from '@testing-library/dom';
import { routeTree } from '../routeTree.gen';
import { queryClient } from './queryClient';

/**
 * Whole pages, as the app renders them: the shell's own router, nav and auth guard, with
 * the microfrontends' pages inside (Storybook maps `mfeAuth/routes`, `mfeChat/routes` and
 * `mfeSettings/routes` to their source). A fake backend in the browser answers the requests
 * with the same shapes auth-service and conversation-service return, so nothing leaves it.
 */

const USER = { id: '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b', email: 'ana@example.com' };
const CHAT_ID = '7d9e1f2a-3b4c-4d5e-8f60-718293a4b5c6';

function chat(id: string, title: string, provider: string, model: string, updatedAt: string) {
  return {
    id,
    title,
    ownerId: USER.id,
    ownerEmail: USER.email,
    provider,
    model,
    reasoning: false,
    webFetch: false,
    createdAt: '2026-10-03T09:15:30.000Z',
    updatedAt,
  };
}

const CHATS = [
  { ...chat(CHAT_ID, 'Weekly planning', 'anthropic', 'claude-sonnet-5-5', '2026-10-04T09:20:45.000Z'), reasoning: true },
  chat('0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e', 'Release notes v2.4', 'openai', 'gpt-4o', '2026-10-03T16:02:11.000Z'),
  chat('5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b', 'Trip to Porto', 'ollama', 'llama3.2:1b', '2026-10-02T11:40:00.000Z'),
];

const REPLY = [
  'Here is a plan for the week, based on your notes:',
  '',
  '## Priorities',
  '',
  '1. **Finish the release notes** for v2.4 by Tuesday.',
  '2. Review the open pull requests on the `conversation-service`.',
  '3. Book a 30-minute retro with the design team.',
  '',
  '| Day | Focus |',
  '| --- | --- |',
  '| Mon | Release notes |',
  '| Wed | Code review |',
  '| Fri | Retro |',
  '',
  '> Keep Thursday free for unplanned work.',
].join('\n');

const MESSAGES = [
  {
    id: 'm-1',
    chatId: CHAT_ID,
    authorId: USER.id,
    authorEmail: USER.email,
    role: 'user',
    content: 'Can you turn my notes into a plan for this week?',
    attachments: [],
    status: 'sent',
    createdAt: '2026-10-04T09:16:00.000Z',
  },
  {
    id: 'm-2',
    chatId: CHAT_ID,
    authorId: USER.id,
    authorEmail: null,
    role: 'assistant',
    content: REPLY,
    reasoning: 'Order the three tasks by deadline, put them in a small table, and keep one day free.',
    webFetches: [],
    attachments: [],
    status: 'sent',
    createdAt: '2026-10-04T09:16:05.000Z',
  },
];

interface Backend {
  signedIn: boolean;
  chats: typeof CHATS;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function fakeFetch(backend: Backend): typeof fetch {
  return async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href);
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.pathname;

    if (path === '/auth/me') {
      return backend.signedIn ? json(USER) : json({ error: { code: 'UNAUTHENTICATED', message: 'Not authenticated' } }, 401);
    }
    if (path === '/auth/login' || path === '/auth/register') return json(USER, path === '/auth/login' ? 200 : 201);
    if (path === '/auth/logout') return new Response(null, { status: 204 });

    if (path === '/api/chats') return json({ chats: backend.chats });
    const match = /^\/api\/chats\/([^/]+)(\/.*)?$/.exec(path);
    if (match) {
      const found = backend.chats.find((c) => c.id === match[1]);
      if (!found) return json({ error: { code: 'NOT_FOUND', message: 'Chat not found' } }, 404);
      const rest = match[2] ?? '';
      if (rest === '/messages' && method === 'GET') return json({ messages: found.id === CHAT_ID ? MESSAGES : [] });
      if (rest === '/members') return json({ members: [{ email: USER.email, role: 'owner', addedAt: found.createdAt }] });
      if (rest === '') return json({ chat: found });
    }
    // Anything a story doesn't cover stays pending rather than reaching a real server.
    return new Promise<Response>(() => undefined);
  };
}

/** An EventSource that never connects: the pages show a settled conversation. */
class SilentEventSource extends EventTarget {
  readonly url: string;
  readonly withCredentials: boolean;
  readonly readyState = 1;
  onopen = null;
  onmessage = null;
  onerror = null;
  constructor(url: string | URL, init?: EventSourceInit) {
    super();
    this.url = String(url);
    this.withCredentials = Boolean(init?.withCredentials);
  }
  close(): void {
    // Nothing to close.
  }
}

const realFetch = window.fetch;
const RealEventSource = window.EventSource;

function AppAt({ path, backend }: { path: string; backend: Backend }) {
  const [router] = useState(() => {
    // Installed before the first render: the session query starts while rendering.
    window.fetch = fakeFetch(backend);
    window.EventSource = SilentEventSource as unknown as typeof EventSource;
    // The shell's query client is a module singleton; start each page from an empty cache.
    queryClient.clear();
    return createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) });
  });

  useEffect(
    () => () => {
      window.fetch = realFetch;
      window.EventSource = RealEventSource;
    },
    [],
  );

  return <RouterProvider router={router} />;
}

const meta = {
  title: 'App/Pages',
  component: AppAt,
  parameters: { layout: 'fullscreen' },
  args: { path: '/chats', backend: { signedIn: true, chats: CHATS } },
  render: (args, context) => <AppAt key={context.id} {...args} />,
} satisfies Meta<typeof AppAt>;
export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Waits until the page shows `text`: the route, the lazily loaded remote, the session check and
 * the remote's own queries resolve after the first render, so the story (and its DOM snapshot in
 * stories.snapshot.test.tsx) is the finished page, not the loading skeleton.
 */
const showsText =
  (text: Matcher): Story['play'] =>
  async ({ canvasElement }) => {
    await within(canvasElement).findAllByText(text, {}, { timeout: 15_000 });
  };

/** `/login` for a signed-out visitor. */
export const Login: Story = {
  args: { path: '/login', backend: { signedIn: false, chats: [] } },
  play: showsText('Enter your email and password to continue.'),
};

/** `/register` for a signed-out visitor. */
export const Register: Story = {
  args: { path: '/register', backend: { signedIn: false, chats: [] } },
  play: showsText('Create an account'),
};

/** `/chats` for a new user with no chats yet. */
export const ChatsEmpty: Story = {
  args: { path: '/chats', backend: { signedIn: true, chats: [] } },
  play: showsText(/No chats yet/),
};

/** `/chats` with a few chats and none open. */
export const Chats: Story = {
  play: showsText('Release notes v2.4'),
};

/** `/chats/:id` with a conversation open next to the list. */
export const ChatOpen: Story = {
  args: { path: `/chats/${CHAT_ID}` },
  play: showsText('Keep Thursday free for unplanned work.'),
};

/** `/settings` with no API keys saved yet. */
export const Settings: Story = {
  args: { path: '/settings' },
  play: showsText('Not configured'),
};
