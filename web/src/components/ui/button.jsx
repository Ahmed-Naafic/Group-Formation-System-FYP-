import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md',
    'text-sm font-semibold transition-colors duration-[200ms]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:translate-y-px',
  ].join(' '),
  {
    variants: {
      variant: {
        default:     'bg-primary text-primary-foreground hover:bg-just-blue-700',
        secondary:   'bg-secondary text-secondary-foreground hover:bg-just-green-600',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-red-700',
        outline:     'border border-border bg-background text-foreground hover:bg-muted',
        ghost:       'text-foreground hover:bg-muted',
        link:        'text-primary underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm:      'h-9 px-3 text-xs',
        lg:      'h-11 px-6 text-base',
        icon:    'h-10 w-10 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
