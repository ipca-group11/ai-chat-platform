import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRemoteRoute } from './createRemoteRoute';
import { RemoteErrorBoundary } from './components/RemoteErrorBoundary';

describe('RemoteErrorBoundary / createRemoteRoute', () => {
  it('AC-27/AC-28: a failed remote import renders a scoped fallback instead of a full-app crash', async () => {
    const FailingRemote = createRemoteRoute('chat', () =>
      Promise.reject(new Error('network down')),
    );

    render(
      <div>
        <nav data-testid="sibling-nav">Nav still here</nav>
        <FailingRemote />
      </div>,
    );

    expect(await screen.findByTestId('remote-fallback-chat')).toBeInTheDocument();
    // The failure is scoped: content outside the failed remote's boundary is
    // untouched and still rendered.
    expect(screen.getByTestId('sibling-nav')).toBeInTheDocument();
  });

  it('AC-29: a sibling route outside the failed scope keeps working while one remote is down', async () => {
    const FailingRemote = createRemoteRoute('settings', () =>
      Promise.reject(new Error('remote entry 404')),
    );
    const WorkingRemote = createRemoteRoute('chat', () =>
      Promise.resolve({ default: () => <div data-testid="chat-content">Chat OK</div> }),
    );

    render(
      <div>
        <FailingRemote />
        <WorkingRemote />
      </div>,
    );

    expect(await screen.findByTestId('remote-fallback-settings')).toBeInTheDocument();
    expect(await screen.findByTestId('chat-content')).toBeInTheDocument();
  });

  it('AC-27: catching a render error only unmounts the boundary\'s own scope, not its siblings', async () => {
    function Boom(): never {
      throw new Error('boom');
    }

    render(
      <div>
        <div data-testid="sibling">Still here</div>
        <RemoteErrorBoundary scopeName="chat">
          <Boom />
        </RemoteErrorBoundary>
      </div>,
    );

    expect(await screen.findByTestId('remote-fallback-chat')).toBeInTheDocument();
    expect(screen.getByTestId('sibling')).toBeInTheDocument();
  });

  it('AC-27: clicking retry re-attempts the failed remote import', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const loader = vi.fn(() => {
      attempts += 1;
      if (attempts === 1) {
        return Promise.reject(new Error('first attempt fails'));
      }
      return Promise.resolve({ default: () => <div data-testid="chat-content">Chat OK</div> });
    });

    const FlakyRemote = createRemoteRoute('chat', loader);

    render(<FlakyRemote />);

    expect(await screen.findByTestId('remote-fallback-chat')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(screen.getByTestId('chat-content')).toBeInTheDocument();
    });
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
