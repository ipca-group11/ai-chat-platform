import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Alert, AlertDescription, AlertTitle, alertVariants } from './alert';

describe('Alert', () => {
  it('renders a div with the alert role and the default variant classes', () => {
    render(<Alert>Saved</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert.tagName).toBe('DIV');
    expect(alert).toHaveAttribute('data-slot', 'alert');
    expect(alert).toHaveTextContent('Saved');
    expect(alert).toHaveClass('border-border', 'bg-card', 'text-card-foreground');
  });

  it('applies the destructive variant', () => {
    render(<Alert variant="destructive">Failed</Alert>);
    expect(screen.getByRole('alert')).toHaveClass('text-destructive', 'border-destructive/50');
    expect(screen.getByRole('alert')).not.toHaveClass('text-card-foreground');
  });

  it('applies the success variant', () => {
    render(<Alert variant="success">Done</Alert>);
    expect(screen.getByRole('alert')).toHaveClass('text-success', 'border-success/50');
  });

  it('lets the caller change the role, e.g. status for a polite announcement', () => {
    render(<Alert role="status">Heads up</Alert>);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('merges a custom class and passes other props through', () => {
    render(<Alert className="mt-4" id="a1" aria-live="polite">x</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('mt-4', 'rounded-lg');
    expect(alert).toHaveAttribute('id', 'a1');
    expect(alert).toHaveAttribute('aria-live', 'polite');
  });

  it('forwards its ref to the div', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Alert ref={ref}>x</Alert>);
    expect(ref.current).toBe(screen.getByRole('alert'));
  });

  it('exposes the variant classes through alertVariants', () => {
    expect(alertVariants()).toContain('text-card-foreground');
    expect(alertVariants({ variant: 'success' })).toContain('text-success');
  });
});

describe('AlertTitle and AlertDescription', () => {
  it('render their slots inside the alert, with caller classes merged', () => {
    render(
      <Alert variant="destructive">
        <AlertTitle className="uppercase">Oops</AlertTitle>
        <AlertDescription className="italic">Invalid email or password.</AlertDescription>
      </Alert>,
    );
    const title = screen.getByText('Oops');
    const description = screen.getByText('Invalid email or password.');
    expect(title).toHaveAttribute('data-slot', 'alert-title');
    expect(title).toHaveClass('font-medium', 'uppercase');
    expect(description).toHaveAttribute('data-slot', 'alert-description');
    expect(description).toHaveClass('text-muted-foreground', 'italic');
    expect(screen.getByRole('alert')).toContainElement(title);
    expect(screen.getByRole('alert')).toContainElement(description);
  });

  it('forward their refs', () => {
    const titleRef = React.createRef<HTMLDivElement>();
    const descRef = React.createRef<HTMLDivElement>();
    render(
      <Alert>
        <AlertTitle ref={titleRef}>t</AlertTitle>
        <AlertDescription ref={descRef}>d</AlertDescription>
      </Alert>,
    );
    expect(titleRef.current?.textContent).toBe('t');
    expect(descRef.current?.textContent).toBe('d');
  });
});
