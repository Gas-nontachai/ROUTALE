export function ActivityTypeBadge({ type }: { type?: string }) {
  if (!type?.trim()) return null;

  return (
    <span className="mt-1 inline-flex max-w-full items-center rounded-md border border-line bg-surface-muted px-2 py-0.5 text-xs font-semibold text-foreground">
      <span className="truncate">{type}</span>
    </span>
  );
}
