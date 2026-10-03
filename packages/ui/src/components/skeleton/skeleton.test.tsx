import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('AC-15: renders a status role placeholder, accessible as "Loading"', () => {
    render(<Skeleton />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('AC-16: applies the animated, token-driven placeholder classes', () => {
    render(<Skeleton />);
    expect(screen.getByRole('status')).toHaveClass('animate-pulse', 'bg-muted');
  });

  it('AC-19: accepts a custom size via className', () => {
    render(<Skeleton className="h-4 w-48" />);
    expect(screen.getByRole('status')).toHaveClass('h-4', 'w-48');
  });
});
