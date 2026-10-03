import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from '../input/input';
import { FormField } from './form-field';

describe('FormField', () => {
  it('AC-15: renders a label associated with its control', () => {
    render(
      <FormField label="Email">
        <Input placeholder="ada@example.com" />
      </FormField>,
    );
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('AC-19: shows description text when there is no error', () => {
    render(
      <FormField label="Email" description="We'll never share your email.">
        <Input />
      </FormField>,
    );
    expect(screen.getByText("We'll never share your email.")).toBeInTheDocument();
  });

  it('AC-19: shows the error message and marks the control invalid instead of the description', () => {
    render(
      <FormField label="Email" description="Helper text" error="Enter a valid email address.">
        <Input />
      </FormField>,
    );
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.queryByText('Helper text')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('AC-19: required marks the label with an asterisk', () => {
    render(
      <FormField label="Email" required>
        <Input />
      </FormField>,
    );
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('AC-19: disabled propagates to the control', () => {
    render(
      <FormField label="Email" disabled>
        <Input />
      </FormField>,
    );
    expect(screen.getByLabelText('Email')).toBeDisabled();
  });
});
