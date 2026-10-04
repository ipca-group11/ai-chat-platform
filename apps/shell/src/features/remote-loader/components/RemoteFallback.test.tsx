import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RemoteFallback } from './RemoteFallback';

describe('RemoteFallback', () => {
  it('announces the failure as an alert that names the section', () => {
    render(<RemoteFallback scopeName="chat" onRetry={() => undefined} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('data-testid', 'remote-fallback-chat');
    expect(alert).toHaveTextContent(/couldn.t load/i);
    expect(alert).toHaveTextContent(/“chat” section failed to load/);
    expect(alert).toHaveTextContent(/rest of the app is still available/i);
  });

  it('calls onRetry when the user presses Retry', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<RemoteFallback scopeName="auth" onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('can be activated from the keyboard', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<RemoteFallback scopeName="auth" onRetry={onRetry} />);

    await user.tab();
    await user.keyboard('{Enter}');

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
