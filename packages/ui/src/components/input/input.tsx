import * as React from 'react';
import { Input as BaseInput } from '@base-ui/react/input';
import { cn } from '@/lib/utils';

export interface InputProps extends React.ComponentPropsWithoutRef<typeof BaseInput> {
  /** Marks the input as invalid (AC-19 "error" state); pairs with FormField's error message. */
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <BaseInput
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
            'ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium ' +
            'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 ' +
            'focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ' +
            'aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
