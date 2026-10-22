import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border text-sm font-semibold leading-[1.4] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#367047] focus-visible:ring-offset-2 active:enabled:scale-[.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'border-[#173d29] bg-[#18543d] text-white shadow-sm hover:enabled:bg-[#124632]',
        primary:
          'border-[#173d29] bg-[#18543d] text-white shadow-sm hover:enabled:bg-[#124632]',
        secondary:
          'border-[#c7dbc8] bg-[#e2eee1] text-[#173d30] hover:enabled:bg-[#d4e5d3]',
        outline:
          'border-[#9aafa0] bg-transparent text-[#173d30] hover:enabled:bg-[#edf3ec]',
        ghost:
          'border-transparent bg-transparent text-[#234e36] hover:enabled:bg-[#edf3ec]',
        soft: 'border-transparent bg-[#edf3e9] text-[#234e36] hover:enabled:bg-[#e2eddd]',
        danger:
          'border-transparent bg-[#fee7e5] text-[#a51d1d] hover:enabled:bg-[#fbd6d3]',
        success:
          'border-transparent bg-[#dcf5dc] text-[#135b3d] hover:enabled:bg-[#c9edce]',
        inverse:
          'border-transparent bg-transparent text-white/80 hover:enabled:bg-white/10 hover:enabled:text-white',
        mapControl:
          'border-transparent bg-transparent text-white hover:enabled:bg-white/15 focus-visible:ring-amber-200 disabled:opacity-40',
        mapSelected:
          'border-transparent bg-white/15 text-white hover:enabled:bg-white/20 focus-visible:ring-amber-200',
        mapStyle:
          'border-transparent bg-transparent text-[#19392c] hover:enabled:bg-green-50 focus-visible:ring-green-700 aria-pressed:bg-green-50 aria-pressed:ring-2 aria-pressed:ring-green-700 disabled:opacity-50',
        unstyled:
          'rounded-none border-transparent bg-transparent p-0 text-inherit shadow-none',
      },
      size: {
        xs: 'h-7 gap-1.5 rounded-md px-2 text-xs',
        sm: 'h-8 gap-1.5 px-3 text-xs',
        default: 'h-10 px-4',
        lg: 'h-12 px-5',
        xl: 'h-14 px-6 text-base',
        icon: 'size-10 p-2',
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
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle className="animate-spin" aria-hidden="true" />}
      {loading ? 'Loading…' : children}
    </Comp>
  );
}
