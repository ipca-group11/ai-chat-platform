import * as React from 'react';
import { cn } from '@/lib/utils';

/** Shared styling for a form label, reused internally by `FormField`'s Base UI `Field.Label`. */
export const labelVariants = 'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70';

export type LabelProps = React.ComponentPropsWithoutRef<'label'>;

/**
 * Standalone accessible label. Associate it with a control via `htmlFor`/`id`.
 * Inside `<FormField>`, the label/control association is wired automatically instead
 * (via Base UI's Field primitives), so this component is for ad-hoc, non-FormField use.
 */
export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => {
  return <label ref={ref} className={cn(labelVariants, className)} {...props} />;
});
Label.displayName = 'Label';
