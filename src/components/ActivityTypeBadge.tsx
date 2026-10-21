export function ActivityTypeBadge({ type }: { type?: string }) {
  if (!type?.trim()) return null;

  return (
    <span className="mt-1 inline-flex max-w-full items-center rounded-md border border-[#BDD9C4] bg-[#E6F2E8] px-2 py-0.5 text-xs font-semibold text-[#285A3A]">
      <span className="truncate">{type}</span>
    </span>
  );
}
