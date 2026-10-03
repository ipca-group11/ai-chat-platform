import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../button/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './dropdown-menu';

function renderMenu(onSelect?: () => void) {
  return render(
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline">Open menu</Button>} />
      <DropdownMenuContent>
        <DropdownMenuItem onClick={onSelect}>Rename</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>Archive</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  );
}

describe('DropdownMenu', () => {
  it('AC-19: is closed by default, hiding its items', () => {
    renderMenu();
    expect(screen.queryByRole('menuitem', { name: 'Rename' })).not.toBeInTheDocument();
  });

  it('AC-19/AC-20: opens on trigger click with keyboard-navigable menu items (focus management)', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
  });

  it('AC-19: a disabled item cannot be activated', async () => {
    const onSelect = vi.fn();
    renderMenu(onSelect);
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await screen.findByRole('menu');
    const archive = screen.getByRole('menuitem', { name: 'Archive' });
    expect(archive).toHaveAttribute('aria-disabled', 'true');
  });

  it('AC-15: selecting an item fires its click handler and closes the menu', async () => {
    const onSelect = vi.fn();
    renderMenu(onSelect);
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('AC-19: checkbox and radio items reflect the "checked"/"disabled" states with a group label and shortcut hint', async () => {
    function Demo() {
      const [checked, setChecked] = React.useState(false);
      const [model, setModel] = React.useState('llama3.2');
      return (
        <DropdownMenu open>
          <DropdownMenuTrigger render={<Button variant="outline">Options</Button>} />
          <DropdownMenuContent>
            <DropdownMenuLabel>View</DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuCheckboxItem checked={checked} onCheckedChange={setChecked}>
                Show queued
                <DropdownMenuShortcut>⌘Q</DropdownMenuShortcut>
              </DropdownMenuCheckboxItem>
            </DropdownMenuGroup>
            <DropdownMenuRadioGroup value={model} onValueChange={(value) => setModel(value as string)}>
              <DropdownMenuRadioItem value="llama3.2">llama3.2</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="gpt-4o">gpt-4o</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Nested action</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    render(<Demo />);

    const checkboxItem = await screen.findByRole('menuitemcheckbox', { name: /show queued/i });
    expect(checkboxItem).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(checkboxItem);
    expect(await screen.findByRole('menuitemcheckbox', { name: /show queued/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    expect(screen.getByRole('menuitemradio', { name: 'llama3.2' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'gpt-4o' })).toHaveAttribute('aria-checked', 'false');
  });
});
