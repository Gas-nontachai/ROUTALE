import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-[9px] whitespace-nowrap border border-transparent text-xs font-semibold leading-[1.4] transition-[background,transform] active:enabled:translate-x-px active:enabled:translate-y-0.5 disabled:cursor-not-allowed [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'border-[#173d29] bg-[#234e36] px-4 py-[11px] text-[#f9f6df] hover:enabled:bg-[#326345] disabled:opacity-[0.42]',
        outline:
          'border-[#9da98b] bg-[#fafbf3] px-4 py-[11px] text-[#405833] hover:enabled:bg-[#ecf0dd]',
        ghost:
          'bg-transparent px-4 py-[11px] text-[#234e36] disabled:opacity-40',
        unstyled: '',
      },
      size: { default: '', icon: 'size-[43px] p-[10px]' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);
export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
