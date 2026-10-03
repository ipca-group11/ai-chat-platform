import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Textarea } from './textarea';

describe('Textarea', () => {
  it('AC-15: renders a native textarea and accepts typed text', async () => {
    render(<Textarea placeholder="Message" />);
    const textarea = screen.getByPlaceholderText('Message');
    await userEvent.type(textarea, 'hi there');
    expect(textarea).toHaveValue('hi there');
  });

  it('AC-16: applies token-driven border/background classes', () => {
    render(<Textarea placeholder="Message" />);
    expect(screen.getByPlaceholderText('Message')).toHaveClass('border-input', 'bg-background');
  });

  it('AC-19: disabled state prevents typing', () => {
    render(<Textarea placeholder="Message" disabled />);
    expect(screen.getByPlaceholderText('Message')).toBeDisabled();
  });

  it('AC-19: invalid state sets aria-invalid for the "error" state', () => {
    render(<Textarea placeholder="Message" invalid />);
    expect(screen.getByPlaceholderText('Message')).toHaveAttribute('aria-invalid', 'true');
  });
});
