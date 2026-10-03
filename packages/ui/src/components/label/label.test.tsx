import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from '../input/input';
import { Label } from './label';

describe('Label', () => {
  it('AC-15: renders a native label element with its text', () => {
    render(<Label htmlFor="email">Email</Label>);
    expect(screen.getByText('Email').tagName).toBe('LABEL');
  });

  it('AC-15: associates with a control via htmlFor so the control is reachable by label text', () => {
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <Input id="email" />
      </>,
    );
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });
});
