import * as React from 'react';
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import { cn } from '@/lib/utils';

/** Shares hover-delay/grouping behavior across multiple tooltips; mount once near the app root. */
export const TooltipProvider = BaseTooltip.Provider;

/** Groups a trigger and its content. Renders nothing itself. */
export const Tooltip = BaseTooltip.Root;

/** The element that opens the tooltip on hover/focus. */
export const TooltipTrigger = BaseTooltip.Trigger;

export interface TooltipContentProps extends React.ComponentPropsWithoutRef<typeof BaseTooltip.Popup> {
  sideOffset?: number;
  side?: React.ComponentProps<typeof BaseTooltip.Positioner>['side'];
}

export const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, sideOffset = 8, side = 'top', ...props }, ref) => (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner side={side} sideOffset={sideOffset}>
        <BaseTooltip.Popup
          ref={ref}
          className={cn(
            'z-50 overflow-hidden rounded-md border border-border bg-popover px-3 py-1.5 text-xs ' +
              'text-popover-foreground shadow-md transition-opacity ' +
              'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0',
            className,
          )}
          {...props}
        />
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  ),
);
TooltipContent.displayName = 'TooltipContent';
