import { unproject, type GPSPoint, type World } from './route';

export type Coordinate = [number, number];

export function routeCoordinates(world: World): Coordinate[][] {
  return world.segments.map((segment) =>
    segment.map((point) => {
      const geo = unproject(world, point.x, point.y);
      return [geo.lon, geo.lat];
    }),
  );
}

export function visibleRoute(world: World, distance: number): Coordinate[][] {
  return world.segments.flatMap((segment) => {
    if (distance <= segment[0].distance) return [];
    const visible = segment.filter((point) => point.distance <= distance);
    if (!visible.length) return [];
    const last = visible.at(-1)!;
    if (distance < segment.at(-1)!.distance && distance > last.distance) {
      const next = segment[segment.indexOf(last) + 1],
        t = (distance - last.distance) / (next.distance - last.distance || 1);
      visible.push({
        ...last,
        x: last.x + (next.x - last.x) * t,
        y: last.y + (next.y - last.y) * t,
      });
    }
    if (visible.length < 2) return [];
    return [
      visible.map((point): Coordinate => {
        const geo = unproject(world, point.x, point.y);
        return [geo.lon, geo.lat];
      }),
    ];
  });
}

export function bearing(from: GPSPoint, to: GPSPoint) {
  const φ1 = (from.lat * Math.PI) / 180,
    φ2 = (to.lat * Math.PI) / 180,
    Δλ = (((to.lon - from.lon + 540) % 360) - 180) * (Math.PI / 180);
  return (
    ((Math.atan2(
      Math.sin(Δλ) * Math.cos(φ2),
      Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ),
    ) *
      180) /
      Math.PI +
      360) %
    360
  );
}

export function travelerFacing(heading: number, mapBearing: number) {
  const angle = (((heading - mapBearing) % 360) + 360) % 360;
  return (['back', 'right', 'front', 'left'] as const)[
    Math.floor((angle + 45) / 90) % 4
  ];
}
