import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
const badgeVariants = cva(
  'inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium not-italic transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        brand: 'border-transparent bg-brand/15 text-[#5b9bff]',
        success: 'border-transparent bg-success/15 text-success',
        warn: 'border-transparent bg-amber-500/15 text-amber-400',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);
function Badge({ className, variant, ...props }) { return <span className={cn(badgeVariants({ variant }), className)} {...props} />; }
export { Badge, badgeVariants };
