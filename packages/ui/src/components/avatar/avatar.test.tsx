import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';

describe('Avatar', () => {
  it('AC-15: renders the fallback while the image has not loaded (jsdom never loads images)', () => {
    render(
      <Avatar>
        <AvatarImage src="https://example.com/avatar.png" alt="Ada Lovelace" />
        <AvatarFallback>AL</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText('AL')).toBeInTheDocument();
  });

  it('AC-16: applies token-driven classes to the fallback', () => {
    render(
      <Avatar>
        <AvatarFallback>AL</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText('AL')).toHaveClass('bg-muted', 'text-muted-foreground');
  });

  it('AC-15: renders the root as a rounded, clipped container', () => {
    render(
      <Avatar data-testid="avatar">
        <AvatarFallback>AL</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByTestId('avatar')).toHaveClass('rounded-full', 'overflow-hidden');
  });
});
