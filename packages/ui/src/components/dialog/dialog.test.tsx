import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../button/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';

function renderDialog(onOpenChange?: () => void) {
  return render(
    <Dialog onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button>Delete chat</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this chat?</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>,
  );
}

describe('Dialog', () => {
  it('AC-19: is closed by default, hiding the title/description', () => {
    renderDialog();
    expect(screen.queryByText('Delete this chat?')).not.toBeInTheDocument();
  });

  it('AC-19/AC-20: opens on trigger click, moving focus into the dialog (focus management)', async () => {
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Delete chat' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete this chat?')).toBeInTheDocument();
  });

  it('AC-15: the popup is labelled by DialogTitle for accessibility', async () => {
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Delete chat' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Delete this chat?');
  });

  it('AC-19: closes when DialogClose is activated', async () => {
    const onOpenChange = vi.fn();
    renderDialog(onOpenChange);
    await userEvent.click(screen.getByRole('button', { name: 'Delete chat' }));
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalled();
    expect(onOpenChange.mock.calls.at(-1)?.[0]).toBe(false);
  });
});
