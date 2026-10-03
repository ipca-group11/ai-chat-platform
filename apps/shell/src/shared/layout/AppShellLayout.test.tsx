import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, recordRequests, server } from '@platform/test-utils/msw';
import { queryClient } from '../../app/queryClient';
import { SESSION_QUERY_KEY } from '../../features/auth-guard/api/useSession';
import { renderWithRouter } from '../test/renderWithRouter';
import { AppShellLayout } from './AppShellLayout';

async function renderLayout(path = '/chats') {
  queryClient.clear();
  return renderWithRouter(
    <QueryClientProvider client={queryClient}>
      <AppShellLayout>
        <p>routed content</p>
      </AppShellLayout>
    </QueryClientProvider>,
    path,
  );
}

const signedInAs = (email: string) =>
  server.use(http.get('*/auth/me', () => HttpResponse.json({ id: 'u1', email })));

describe('AppShellLayout', () => {
  it('renders the routed children inside <main>, under the navigation', async () => {
    signedInAs('ana@example.com');
    await renderLayout();

    expect(screen.getByRole('main')).toHaveTextContent('routed content');
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('shows the signed-in user in the nav once the session loads', async () => {
    signedInAs('ana@example.com');
    await renderLayout();

    expect(await screen.findByText('ana@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('hides the app links when nobody is signed in (401)', async () => {
    server.use(http.get('*/auth/me', () => HttpResponse.json({}, { status: 401 })));
    await renderLayout('/login');

    await waitFor(() => expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toBeNull());
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
  });

  it('logs out: POST /auth/logout, clears the cached session and goes to /login', async () => {
    signedInAs('ana@example.com');
    const user = userEvent.setup();
    const { router } = await renderLayout();
    const requests = recordRequests();

    await user.click(await screen.findByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toContain('POST /auth/logout');
    expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toBeNull();
    await waitFor(() => expect(screen.queryByText('ana@example.com')).not.toBeInTheDocument());
  });

  it('still clears the session and goes to /login when the logout request fails', async () => {
    signedInAs('ana@example.com');
    server.use(http.post('*/auth/logout', () => HttpResponse.json({ error: 'down' }, { status: 500 })));
    const user = userEvent.setup();
    const { router } = await renderLayout();

    await user.click(await screen.findByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toBeNull();
  });
});
