import * as React from 'react';
import { Toast as BaseToast } from '@base-ui/react/toast';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Provides toast state/queue; mount once near the app root. */
export const ToastProvider = BaseToast.Provider;
export const useToastManager = BaseToast.useToastManager;
export const createToastManager = BaseToast.createToastManager;

export const ToastViewport = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseToast.Viewport>
>(({ className, ...props }, ref) => (
  <BaseToast.Viewport
    ref={ref}
    className={cn(
      'fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-sm',
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = 'ToastViewport';

export interface ToastProps extends React.ComponentPropsWithoutRef<typeof BaseToast.Root> {
  variant?: 'default' | 'destructive' | 'success';
}

const toastVariantClassName: Record<NonNullable<ToastProps['variant']>, string> = {
  default: 'border-border bg-background text-foreground',
  destructive: 'border-destructive bg-destructive text-destructive-foreground',
  success: 'border-success bg-success text-success-foreground',
};

/** An individual toast; render one per entry from `useToastManager().toasts`. */
export const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <BaseToast.Root
      ref={ref}
      className={cn(
        'pointer-events-auto relative flex w-full items-start justify-between gap-3 overflow-hidden rounded-md ' +
          'border p-4 shadow-lg transition-all data-[starting-style]:translate-x-full ' +
          'data-[ending-style]:opacity-0 data-[swipe-direction=right]:transition-none',
        toastVariantClassName[variant],
        className,
      )}
      {...props}
    />
  ),
);
Toast.displayName = 'Toast';

export const ToastTitle = React.forwardRef<HTMLHeadingElement, React.ComponentPropsWithoutRef<typeof BaseToast.Title>>(
  ({ className, ...props }, ref) => (
    <BaseToast.Title ref={ref} className={cn('text-sm font-semibold', className)} {...props} />
  ),
);
ToastTitle.displayName = 'ToastTitle';

export const ToastDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof BaseToast.Description>
>(({ className, ...props }, ref) => (
  <BaseToast.Description ref={ref} className={cn('text-sm opacity-90', className)} {...props} />
));
ToastDescription.displayName = 'ToastDescription';

export const ToastAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof BaseToast.Action>
>(({ className, ...props }, ref) => (
  <BaseToast.Action
    ref={ref}
    className={cn(
      'inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-transparent bg-transparent ' +
        'px-3 text-sm font-medium underline-offset-4 hover:underline focus:outline-none focus:ring-2 ' +
        'focus:ring-ring',
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = 'ToastAction';

export const ToastClose = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof BaseToast.Close>>(
  ({ className, ...props }, ref) => (
    <BaseToast.Close
      ref={ref}
      aria-label="Close"
      className={cn(
        'absolute right-2 top-2 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none ' +
          'focus:ring-2 focus:ring-ring',
        className,
      )}
      {...props}
    >
      <X className="size-4" />
    </BaseToast.Close>
  ),
);
ToastClose.displayName = 'ToastClose';

/**
 * Renders every queued toast from `useToastManager()`. Mount once, inside `<ToastProvider>`,
 * near the app root (alongside `<ToastViewport>`).
 */
export function Toaster() {
  const { toasts } = useToastManager();
  return (
    <ToastViewport>
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} variant={(toast.type as ToastProps['variant']) ?? 'default'}>
          {toast.title ? <ToastTitle>{toast.title}</ToastTitle> : null}
          {toast.description ? <ToastDescription>{toast.description}</ToastDescription> : null}
          <ToastClose />
        </Toast>
      ))}
    </ToastViewport>
  );
}
