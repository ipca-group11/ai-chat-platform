import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRemoteRoute } from './createRemoteRoute';

/**
 * Remotes served by the mock server (testing/mock-server, `/remotes/<name>/remoteEntry.js`).
 * To try the same flow against the real mock, start it (`pnpm exec nx serve mock-server`) and
 * point `VITE_MFE_CHAT_URL` at `http://localhost:4010/remotes/<404|broken-js|slow|ok>`.
 * Here `fetch` answers what the mock answers, so the test needs no running server.
 */
const MOCK_BASE = 'http://localhost:4010/remotes';

const OK_ENTRY = 'return { get: async () => () => ({ default: () => null }) };';
const BROKEN_ENTRY = 'const get = (module => { return ;;; this is not valid javascript }}}';

const mockAnswers: Record<string, () => Response> = {
  ok: () => new Response(OK_ENTRY, { status: 200 }),
  '404': () => new Response('Remote "404" not found', { status: 404 }),
  'broken-js': () => new Response(BROKEN_ENTRY, { status: 200 }),
};

/** A loader shaped like a federated import: fetch the entry, then evaluate it. */
function loaderFor(name: string) {
  return async () => {
    const res = await fetch(`${MOCK_BASE}/${name}/remoteEntry.js`);
    if (!res.ok) throw new Error(`remoteEntry.js answered ${res.status}`);
    new Function(await res.text())(); // a SyntaxError here rejects the import
    return { default: () => <div data-testid="remote-content">Remote loaded</div> };
  };
}

function stubMockServer() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const name = new URL(url).pathname.split('/')[2] ?? '';
      return (mockAnswers[name] ?? mockAnswers['404']!)();
    }),
  );
}

describe('RemoteFallback with the mock server remotes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ['404', /couldn.t load/i],
    ['broken-js', /couldn.t load/i],
  ])('shows the RemoteFallback when the remote is "%s"', async (name, title) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubMockServer();
    const Remote = createRemoteRoute('chat', loaderFor(name));

    render(
      <div>
        <nav data-testid="sibling-nav">Nav still here</nav>
        <Remote />
      </div>,
    );

    expect(await screen.findByTestId('remote-fallback-chat')).toBeInTheDocument();
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByTestId('sibling-nav')).toBeInTheDocument();
    expect(screen.queryByTestId('remote-content')).not.toBeInTheDocument();
  });

  it('renders the remote, without a fallback, when it is "ok"', async () => {
    stubMockServer();
    const Remote = createRemoteRoute('chat', loaderFor('ok'));

    render(<Remote />);

    expect(await screen.findByTestId('remote-content')).toBeInTheDocument();
    expect(screen.queryByTestId('remote-fallback-chat')).not.toBeInTheDocument();
  });
});
