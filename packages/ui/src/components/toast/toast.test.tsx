import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../button/button';
import { Toast, ToastAction, ToastProvider, ToastTitle, ToastViewport, Toaster, useToastManager } from './toast';

function Demo() {
  const toastManager = useToastManager();
  return (
    <>
      <Button
        onClick={() =>
          toastManager.add({ title: 'Message sent', description: 'Your message was delivered.' })
        }
      >
        Send
      </Button>
      <Toaster />
    </>
  );
}

describe('Toast', () => {
  it('AC-19: shows no toast until one is queued', () => {
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    );
    expect(screen.queryByText('Message sent')).not.toBeInTheDocument();
  });

  it('AC-19: queuing a toast renders its title and description', async () => {
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Message sent')).toBeInTheDocument();
    expect(screen.getByText('Your message was delivered.')).toBeInTheDocument();
  });

  it('AC-19: a toast can be dismissed via its close button', async () => {
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    const toast = await screen.findByRole('dialog', { name: 'Message sent' });
    // The close button is only exposed to assistive tech once the toast (or the
    // viewport) has focus/hover, mirroring the "reveal on hover" stacked-toast UX.
    await userEvent.hover(toast);
    await userEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByText('Message sent')).not.toBeInTheDocument();
  });

  it('AC-16/AC-19: ToastAction renders an actionable button and applies the "destructive" variant classes', async () => {
    const onAction = vi.fn();
    render(
      <ToastProvider>
        <ToastViewport>
          <Toast toast={{ id: '1' }} variant="destructive" data-testid="toast">
            <ToastTitle>Provider error</ToastTitle>
            <ToastAction onClick={onAction}>Retry</ToastAction>
          </Toast>
        </ToastViewport>
      </ToastProvider>,
    );
    expect(screen.getByTestId('toast')).toHaveClass('bg-destructive', 'text-destructive-foreground');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('AC-16: applies the "success" variant classes', () => {
    render(
      <ToastProvider>
        <ToastViewport>
          <Toast toast={{ id: '2' }} variant="success" data-testid="toast">
            <ToastTitle>Saved</ToastTitle>
          </Toast>
        </ToastViewport>
      </ToastProvider>,
    );
    expect(screen.getByTestId('toast')).toHaveClass('bg-success', 'text-success-foreground');
  });
});
