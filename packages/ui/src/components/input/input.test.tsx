import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './input';
import { expectNoA11yViolations } from '../../test/a11y';

describe('Input', () => {
  it('AC-15: renders a native input and accepts typed text', async () => {
    render(<Input placeholder="Email" />);
    const input = screen.getByPlaceholderText('Email');
    await userEvent.type(input, 'hello');
    expect(input).toHaveValue('hello');
  });

  it('AC-16: applies token-driven border/background classes', () => {
    render(<Input placeholder="Email" />);
    expect(screen.getByPlaceholderText('Email')).toHaveClass('border-input', 'bg-background');
  });

  it('AC-19: disabled state prevents typing', async () => {
    render(<Input placeholder="Email" disabled />);
    const input = screen.getByPlaceholderText('Email');
    expect(input).toBeDisabled();
  });

  it('AC-19: invalid state sets aria-invalid for the "error" state', () => {
    render(<Input placeholder="Email" invalid />);
    expect(screen.getByPlaceholderText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('AC-15: forwards onChange handler', async () => {
    const onChange = vi.fn();
    render(<Input placeholder="Email" onChange={onChange} />);
    await userEvent.type(screen.getByPlaceholderText('Email'), 'a');
    expect(onChange).toHaveBeenCalled();
  });

  it('AICHAT-176: no axe violations when labelled, disabled and invalid', async () => {
    const { container } = render(
      <form>
        <label htmlFor="email">Email</label>
        <Input id="email" type="email" />
        <label htmlFor="name">Name</label>
        <Input id="name" disabled />
        <label htmlFor="key">API key</label>
        <Input id="key" invalid aria-describedby="key-error" />
        <p id="key-error">API key is required.</p>
      </form>,
    );
    await expectNoA11yViolations(container);
  });
});
