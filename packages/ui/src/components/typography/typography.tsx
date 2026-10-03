import * as React from 'react';
import { cn } from '@/lib/utils';

// Typography scale/hierarchy following the shadcn Typeset (AC-17).

export const H1 = React.forwardRef<HTMLHeadingElement, React.ComponentPropsWithoutRef<'h1'>>(
  ({ className, ...props }, ref) => (
    <h1
      ref={ref}
      className={cn(
        'scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl',
        className,
      )}
      {...props}
    />
  ),
);
H1.displayName = 'H1';

export const H2 = React.forwardRef<HTMLHeadingElement, React.ComponentPropsWithoutRef<'h2'>>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn(
        'scroll-m-20 border-b border-border pb-2 text-3xl font-semibold tracking-tight first:mt-0',
        className,
      )}
      {...props}
    />
  ),
);
H2.displayName = 'H2';

export const H3 = React.forwardRef<HTMLHeadingElement, React.ComponentPropsWithoutRef<'h3'>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('scroll-m-20 text-2xl font-semibold tracking-tight', className)} {...props} />
  ),
);
H3.displayName = 'H3';

export const H4 = React.forwardRef<HTMLHeadingElement, React.ComponentPropsWithoutRef<'h4'>>(
  ({ className, ...props }, ref) => (
    <h4 ref={ref} className={cn('scroll-m-20 text-xl font-semibold tracking-tight', className)} {...props} />
  ),
);
H4.displayName = 'H4';

export const P = React.forwardRef<HTMLParagraphElement, React.ComponentPropsWithoutRef<'p'>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('leading-7 [&:not(:first-child)]:mt-6', className)} {...props} />
  ),
);
P.displayName = 'P';

export const Lead = React.forwardRef<HTMLParagraphElement, React.ComponentPropsWithoutRef<'p'>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-xl text-muted-foreground', className)} {...props} />
  ),
);
Lead.displayName = 'Lead';

export const Large = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-lg font-semibold', className)} {...props} />
  ),
);
Large.displayName = 'Large';

export const Small = React.forwardRef<HTMLElement, React.ComponentPropsWithoutRef<'small'>>(
  ({ className, ...props }, ref) => (
    <small ref={ref} className={cn('text-sm font-medium leading-none', className)} {...props} />
  ),
);
Small.displayName = 'Small';

export const Muted = React.forwardRef<HTMLParagraphElement, React.ComponentPropsWithoutRef<'p'>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  ),
);
Muted.displayName = 'Muted';

export const Blockquote = React.forwardRef<HTMLQuoteElement, React.ComponentPropsWithoutRef<'blockquote'>>(
  ({ className, ...props }, ref) => (
    <blockquote ref={ref} className={cn('mt-6 border-l-2 border-border pl-6 italic text-foreground', className)} {...props} />
  ),
);
Blockquote.displayName = 'Blockquote';

export const InlineCode = React.forwardRef<HTMLElement, React.ComponentPropsWithoutRef<'code'>>(
  ({ className, ...props }, ref) => (
    <code
      ref={ref}
      className={cn(
        'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold',
        className,
      )}
      {...props}
    />
  ),
);
InlineCode.displayName = 'InlineCode';

export const List = React.forwardRef<HTMLUListElement, React.ComponentPropsWithoutRef<'ul'>>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} className={cn('my-6 ml-6 list-disc [&>li]:mt-2', className)} {...props} />
  ),
);
List.displayName = 'List';
