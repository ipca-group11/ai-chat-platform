import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { expectNoA11yViolations } from '../../test/a11y';

function renderSelect(onValueChange?: (value: string) => void) {
  return render(
    <Select onValueChange={onValueChange as never}>
      <SelectTrigger aria-label="Model">
        <SelectValue placeholder="Select a model" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="llama3.2:1b">llama3.2:1b</SelectItem>
        <SelectItem value="gpt-4o">gpt-4o</SelectItem>
      </SelectContent>
    </Select>,
  );
}

describe('Select', () => {
  it('AC-15: shows the placeholder when nothing is selected', () => {
    renderSelect();
    expect(screen.getByText('Select a model')).toBeInTheDocument();
  });

  it('AC-19/AC-20: opens the listbox on trigger click (focus management)', async () => {
    renderSelect();
    await userEvent.click(screen.getByRole('combobox', { name: 'Model' }));
    expect(await screen.findByRole('option', { name: 'gpt-4o' })).toBeInTheDocument();
  });

  it('AC-15: selecting an option calls onValueChange with the selected value', async () => {
    const onValueChange = vi.fn();
    renderSelect(onValueChange);
    await userEvent.click(screen.getByRole('combobox', { name: 'Model' }));
    await userEvent.click(await screen.findByRole('option', { name: 'gpt-4o' }));
    expect(onValueChange).toHaveBeenCalledWith('gpt-4o', expect.anything());
  });

  it('AC-19: disabled select cannot be opened', () => {
    render(
      <Select disabled>
        <SelectTrigger aria-label="Model">
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="llama3.2:1b">llama3.2:1b</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(screen.getByRole('combobox', { name: 'Model' })).toBeDisabled();
  });

  it('AICHAT-176: no axe violations when closed and when the listbox is open (in a portal)', async () => {
    const { container } = renderSelect();
    await expectNoA11yViolations(container);
    await userEvent.click(screen.getByRole('combobox', { name: 'Model' }));
    await screen.findByRole('listbox');
    await expectNoA11yViolations(document.body);
  });
});
