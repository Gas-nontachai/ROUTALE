import { LoaderCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export function LoadingState({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center justify-center gap-2 text-sm text-muted',
        className,
      )}
    >
      <LoaderCircle
        className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}
