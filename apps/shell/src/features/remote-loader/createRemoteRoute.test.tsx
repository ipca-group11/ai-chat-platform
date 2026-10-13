import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRemoteRoute } from './createRemoteRoute';

describe('createRemoteRoute', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows an accessible loading skeleton until the remote has loaded, then the remote', async () => {
    let resolveRemote!: (module: { default: () => React.ReactElement }) => void;
    const pending = new Promise<{ default: () => React.ReactElement }>((resolve) => {
      resolveRemote = resolve;
    });
    const Remote = createRemoteRoute('chat', () => pending);

    render(<Remote />);

    expect(screen.getByTestId('remote-loading-chat')).toHaveTextContent('Loading chat');
    expect(screen.queryByTestId('remote-fallback-chat')).not.toBeInTheDocument();

    await act(async () => {
      resolveRemote({ default: () => <p>chat is here</p> });
    });

    expect(await screen.findByText('chat is here')).toBeInTheDocument();
    expect(screen.queryByTestId('remote-loading-chat')).not.toBeInTheDocument();
  });

  it('names the route after its scope, for React DevTools and error stacks', () => {
    const Remote = createRemoteRoute('settings', () => Promise.resolve({ default: () => null }));
    expect(Remote.displayName).toBe('RemoteRoute(settings)');
  });

  it('shows the scoped fallback with the failure logged when the import rejects', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Remote = createRemoteRoute('auth', () => Promise.reject(new Error('404')));

    render(<Remote />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveAttribute('data-testid', 'remote-fallback-auth');
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('remote "auth" failed'),
      expect.objectContaining({ scopeName: 'auth', name: 'RemoteLoadError' }),
    );
  });

  it('keeps failing visibly if the retry fails too, and recovers when a later retry works', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const loader = vi
      .fn<() => Promise<{ default: () => React.ReactElement }>>()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockResolvedValue({ default: () => <p>chat is here</p> });
    const Remote = createRemoteRoute('chat', loader);

    render(<Remote />);

    await user.click(await screen.findByRole('button', { name: 'Retry' }));
    await user.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('chat is here')).toBeInTheDocument();
    expect(loader).toHaveBeenCalledTimes(3);
  });

  it('uses the retry loader, with the attempt number, for every load after the first (AICHAT-164)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const loader = vi.fn(() => Promise.reject(new Error('first')));
    const retryLoader = vi
      .fn<(attempt: number) => Promise<{ default: () => React.ReactElement }>>()
      .mockRejectedValueOnce(new Error('still down'))
      .mockResolvedValue({ default: () => <p>chat is here</p> });
    const Remote = createRemoteRoute('chat', loader, retryLoader);

    render(<Remote />);

    await user.click(await screen.findByRole('button', { name: 'Retry' }));
    await user.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('chat is here')).toBeInTheDocument();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(retryLoader.mock.calls).toEqual([[1], [2]]);
  });
});
