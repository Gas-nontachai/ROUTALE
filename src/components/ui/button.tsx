import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border text-sm font-semibold leading-[1.4] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none active:enabled:brightness-95 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'border-primary bg-primary text-on-primary shadow-sm hover:enabled:bg-primary-hover',
        primary:
          'border-primary bg-primary text-on-primary shadow-sm hover:enabled:bg-primary-hover',
        secondary:
          'border-line bg-accent text-accent-foreground hover:enabled:bg-surface-muted',
        outline:
          'border-line bg-surface text-foreground hover:enabled:bg-surface-muted',
        ghost:
          'border-transparent bg-transparent text-foreground hover:enabled:bg-surface-muted',
        soft: 'border-transparent bg-surface-muted text-foreground hover:enabled:bg-accent',
        danger:
          'border-transparent bg-danger-surface text-danger hover:enabled:brightness-95',
        success:
          'border-transparent bg-accent text-accent-foreground hover:enabled:brightness-95',
        inverse:
          'border-transparent bg-transparent text-white/80 hover:enabled:bg-white/10 hover:enabled:text-white',
        mapControl:
          'border-transparent bg-transparent text-white hover:enabled:bg-white/15 focus-visible:ring-amber-200 disabled:opacity-40',
        mapSelected:
          'border-transparent bg-white/15 text-white hover:enabled:bg-white/20 focus-visible:ring-amber-200',
        mapStyle:
          'border-transparent bg-transparent text-foreground hover:enabled:bg-accent focus-visible:ring-primary aria-pressed:bg-accent aria-pressed:ring-2 aria-pressed:ring-primary disabled:opacity-50',
        unstyled:
          'rounded-none border-transparent bg-transparent p-0 text-inherit shadow-none',
      },
      size: {
        xs: 'min-h-11 gap-1.5 rounded-md px-2 text-xs',
        sm: 'min-h-11 gap-1.5 px-3 text-xs',
        default: 'min-h-11 px-4',
        lg: 'h-12 px-5',
        xl: 'h-14 px-6 text-base',
        icon: 'size-11 p-2',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && !asChild ? (
        <>
          <LoaderCircle className="animate-spin" aria-hidden="true" />
          Loading…
        </>
      ) : (
        children
      )}
    </Comp>
  );
}
