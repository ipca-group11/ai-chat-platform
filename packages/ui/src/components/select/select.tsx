import * as React from 'react';
import { Select as BaseSelect } from '@base-ui/react/select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Groups all parts of the select. Renders nothing itself. */
export const Select = BaseSelect.Root;
export const SelectGroup = BaseSelect.Group;
export const SelectValue = BaseSelect.Value;

export const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof BaseSelect.Trigger>
>(({ className, children, ...props }, ref) => (
  <BaseSelect.Trigger
    ref={ref}
    className={cn(
      'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 ' +
        'text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 ' +
        'focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ' +
        'aria-[invalid=true]:border-destructive [&>span]:line-clamp-1',
      className,
    )}
    {...props}
  >
    {children}
    <BaseSelect.Icon>
      <ChevronDown className="size-4 opacity-50" />
    </BaseSelect.Icon>
  </BaseSelect.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

export const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseSelect.Popup> & { sideOffset?: number }
>(({ className, children, sideOffset = 4, ...props }, ref) => (
  <BaseSelect.Portal>
    <BaseSelect.Positioner sideOffset={sideOffset} className="z-50">
      <BaseSelect.ScrollUpArrow className="flex items-center justify-center py-1">
        <ChevronUp className="size-4" />
      </BaseSelect.ScrollUpArrow>
      <BaseSelect.Popup
        ref={ref}
        className={cn(
          'max-h-[--available-height] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border ' +
            'border-border bg-popover p-1 text-popover-foreground shadow-md transition-[opacity,transform] ' +
            'data-[starting-style]:opacity-0 data-[starting-style]:scale-95 ' +
            'data-[ending-style]:opacity-0 data-[ending-style]:scale-95',
          className,
        )}
        {...props}
      >
        <BaseSelect.List>{children}</BaseSelect.List>
      </BaseSelect.Popup>
      <BaseSelect.ScrollDownArrow className="flex items-center justify-center py-1">
        <ChevronDown className="size-4" />
      </BaseSelect.ScrollDownArrow>
    </BaseSelect.Positioner>
  </BaseSelect.Portal>
));
SelectContent.displayName = 'SelectContent';

export const SelectLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseSelect.GroupLabel>
>(({ className, ...props }, ref) => (
  <BaseSelect.GroupLabel ref={ref} className={cn('px-2 py-1.5 text-sm font-semibold', className)} {...props} />
));
SelectLabel.displayName = 'SelectLabel';

export const SelectItem = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof BaseSelect.Item>>(
  ({ className, children, ...props }, ref) => (
    <BaseSelect.Item
      ref={ref}
      className={cn(
        'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm ' +
          'outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground ' +
          'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <BaseSelect.ItemIndicator>
          <Check className="size-4" />
        </BaseSelect.ItemIndicator>
      </span>
      <BaseSelect.ItemText>{children}</BaseSelect.ItemText>
    </BaseSelect.Item>
  ),
);
SelectItem.displayName = 'SelectItem';

export const SelectSeparator = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseSelect.Separator>
>(({ className, ...props }, ref) => (
  <BaseSelect.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
));
SelectSeparator.displayName = 'SelectSeparator';
