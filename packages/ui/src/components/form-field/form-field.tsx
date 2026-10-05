import * as React from 'react';
import { Field } from '@base-ui/react/field';
import { cn } from '@/lib/utils';
import { labelVariants } from '../label/label';

export interface FormFieldProps {
  /** Field label text/content. */
  label: React.ReactNode;
  /** Helper text shown when there is no error. */
  description?: React.ReactNode;
  /** Error message (AC-19 "error" state); when set, replaces the description and marks the control invalid. */
  error?: React.ReactNode;
  /** `data-testid` of the error message, for end-to-end tests. */
  errorTestId?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** The form control, e.g. `<Input />` or `<Textarea />`. Receives `invalid`/`disabled`. */
  children: React.ReactElement;
}

/**
 * Groups a label, a single form control, optional helper text, and an error message,
 * wiring accessible association (`Field.Root`/`Field.Label`) between them.
 */
export const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ label, description, error, errorTestId, required, disabled, className, children }, ref) => {
    const control = React.isValidElement(children)
      ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
          invalid: Boolean(error),
          disabled: disabled ?? (children.props as Record<string, unknown>).disabled,
        })
      : children;

    return (
      <Field.Root ref={ref} disabled={disabled} className={cn('space-y-2', className)}>
        <Field.Label className={labelVariants}>
          {label}
          {required ? (
            <span aria-hidden="true" className="ml-0.5 text-destructive">
              *
            </span>
          ) : null}
        </Field.Label>
        {control}
        {error ? (
          <Field.Error match data-testid={errorTestId} className="text-sm font-medium text-destructive">
            {error}
          </Field.Error>
        ) : description ? (
          <Field.Description className="text-sm text-muted-foreground">{description}</Field.Description>
        ) : null}
      </Field.Root>
    );
  },
);
FormField.displayName = 'FormField';
