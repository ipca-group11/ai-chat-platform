import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';

describe('Card', () => {
  it('AC-15: composes header, title, description, content, and footer parts', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Content</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>,
    );
    expect(screen.getByText('Title').tagName).toBe('H3');
    expect(screen.getByText('Description').tagName).toBe('P');
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('AC-16: applies token-driven surface classes to the root', () => {
    render(<Card data-testid="card">content</Card>);
    expect(screen.getByTestId('card')).toHaveClass('bg-card', 'text-card-foreground', 'border-border');
  });

  it('AC-15: forwards a custom className alongside the base classes', () => {
    render(<Card data-testid="card" className="w-80" />);
    expect(screen.getByTestId('card')).toHaveClass('w-80', 'rounded-lg');
  });
});
