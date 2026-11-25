import * as React from 'react';
import { cn } from '@/lib/utils';
const Input = React.forwardRef(({ className, type, ...props }, ref) => (
  <input type={type} ref={ref} className={cn('flex h-10 w-full rounded-full border border-input bg-background px-4 py-2 text-base text-foreground outline-none ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50', className)} {...props} />
));
Input.displayName = 'Input';
export { Input };
