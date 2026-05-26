import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
  {
    variants: {
      variant: {
        default:     'bg-[var(--badge-blue-bg)]    text-[var(--badge-blue-fg)]    ring-[var(--badge-blue-ring)]',
        secondary:   'bg-[var(--badge-neutral-bg)] text-[var(--badge-neutral-fg)] ring-[var(--badge-neutral-ring)]',
        success:     'bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)] ring-[var(--badge-success-ring)]',
        warning:     'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-fg)] ring-[var(--badge-warning-ring)]',
        destructive: 'bg-[var(--badge-danger-bg)]  text-[var(--badge-danger-fg)]  ring-[var(--badge-danger-ring)]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
