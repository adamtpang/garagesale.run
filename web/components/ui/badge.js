import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
const badgeVariants = cva(
  'inline-flex items-center whitespace-nowrap rounded border border-foreground px-2 py-0.5 text-xs font-bold not-italic text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary',
        destructive: 'bg-destructive text-destructive-foreground',
        outline: 'bg-card',
        brand: 'bg-brand',
        success: 'bg-[#9be8b8]',
        warn: 'bg-amber-300',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);
function Badge({ className, variant, ...props }) { return <span className={cn(badgeVariants({ variant }), className)} {...props} />; }
export { Badge, badgeVariants };
