import { Bike, Footprints, Mountain, Route } from 'lucide-react';
import { activityKind } from '../lib/analysis';

export function ActivityTypeBadge({ type }: { type?: string }) {
  if (!type?.trim()) return null;
  const icons = {
    cycling: Bike,
    running: Footprints,
    walking: Footprints,
    hiking: Mountain,
    'trail-running': Mountain,
    unknown: Route,
  };
  const Icon = icons[activityKind(type)];
  return (
    <span
      role="img"
      aria-label={type}
      title={type}
      className="inline-flex shrink-0 items-center text-muted"
    >
      <Icon size={20} aria-hidden="true" />
    </span>
  );
}
