import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';
import { expectNoA11yViolations } from '../../test/a11y';

describe('Button', () => {
  it('AC-15: renders a native button element with its children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('AC-16: applies the default variant/theming classes driven by design tokens', () => {
    render(<Button>Themed</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-primary', 'text-primary-foreground');
  });

  it('AC-19: applies distinct classes per variant (e.g. "destructive" state)', () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-destructive');
  });

  it('AC-19: disabled state prevents interaction', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('AC-19: loading state disables the button and marks it aria-busy', () => {
    render(<Button loading>Saving</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('AC-15: forwards click handler when enabled', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('AICHAT-176: no axe violations in its variants, sizes and states', async () => {
    const { container } = render(
      <div>
        <Button>Save</Button>
        <Button variant="destructive">Delete</Button>
        <Button variant="outline">Cancel</Button>
        <Button variant="ghost" size="icon" aria-label="Close pane">
          <svg aria-hidden="true" />
        </Button>
        <Button disabled>Disabled</Button>
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it('AICHAT-176: the check fails for an icon button without a name (button-name)', async () => {
    const { container } = render(
      <Button size="icon">
        <svg aria-hidden="true" />
      </Button>,
    );
    await expect(expectNoA11yViolations(container)).rejects.toThrow(/button-name/);
  });
});
