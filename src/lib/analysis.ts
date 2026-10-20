import { meters, type Activity, type GPSPoint } from './route';
export type RoutePoint = GPSPoint & { sourceIndex: number; distance: number };
export type Movement = {
  type: 'stay' | 'loop' | 'backtracking';
  segment: number;
  startIndex: number;
  endIndex: number;
  duration?: number;
  loopCount?: number;
  compressedFrom?: number;
};
export type RouteStats = {
  distance: number;
  duration?: number;
  ascent?: number;
  descent?: number;
  minElevation?: number;
  maxElevation?: number;
  partialTime: boolean;
  partialElevation: boolean;
  filteredPoints: number;
};
export type ProcessedRoute = {
  segments: RoutePoint[][];
  movements: Movement[];
  stats: RouteStats;
};
const time = (p: GPSPoint) => (p.time ? Date.parse(p.time) / 1000 : NaN);
const median = (values: number[]) =>
  values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
function sample(segment: RoutePoint[], spacing: number) {
  const result: RoutePoint[] = [segment[0]];
  let target = segment[0].distance + spacing;
  for (let i = 1; i < segment.length; i++) {
    const a = segment[i - 1],
      b = segment[i];
    while (target < b.distance) {
      const t = (target - a.distance) / (b.distance - a.distance);
      result.push({
        ...a,
        lat: a.lat + (b.lat - a.lat) * t,
        lon: a.lon + (((b.lon - a.lon + 540) % 360) - 180) * t,
        distance: target,
        sourceIndex: i - 1,
      });
      target += spacing;
    }
  }
  result.push({
    ...segment[segment.length - 1],
    sourceIndex: segment.length - 1,
  });
  return result;
}
function signature(points: RoutePoint[]) {
  const start = points[0].distance,
    length = points[points.length - 1].distance - start;
  let j = 1;
  return Array.from({ length: 25 }, (_, i) => {
    const distance = start + (length * i) / 24;
    while (j < points.length - 1 && points[j].distance < distance) j++;
    const a = points[j - 1],
      b = points[j],
      t = (distance - a.distance) / (b.distance - a.distance || 1);
    return {
      lat: a.lat + (b.lat - a.lat) * t,
      lon: a.lon + (((b.lon - a.lon + 540) % 360) - 180) * t,
    };
  });
}
function detectMovement(
  segment: RoutePoint[],
  segmentIndex: number,
): Movement[] {
  const movements: Movement[] = [];
  // A stay describes time spent in an area, not whether the person was motionless.
  for (let i = 0; i < segment.length - 1; i++) {
    if (!Number.isFinite(time(segment[i]))) continue;
    const noise = Math.min(5, meters(segment[i], segment[i + 1]) * 0.2),
      radius = 25 + noise;
    let j = i + 1;
    while (
      j < segment.length &&
      Number.isFinite(time(segment[j])) &&
      time(segment[j]) > time(segment[j - 1]) &&
      meters(segment[i], segment[j]) <= radius
    )
      j++;
    const end = j - 1,
      duration = time(segment[end]) - time(segment[i]);
    if (j === segment.length && duration < 300) break;
    if (duration >= 300) {
      movements.push({
        type: 'stay',
        segment: segmentIndex,
        startIndex: i,
        endIndex: end,
        duration,
      });
      i = end;
    }
  }
  const total = segment[segment.length - 1].distance - segment[0].distance;
  const sampled = sample(segment, Math.max(15, total / 20000));
  const backtracks: { start: number; end: number }[] = [];
  for (let i = 3; i < sampled.length - 3; i++) {
    if (
      meters(sampled[i - 2], sampled[i + 2]) > 30 ||
      meters(sampled[i], sampled[i - 2]) < 20
    )
      continue;
    let k = 1;
    while (
      i - k >= 0 &&
      i + k < sampled.length &&
      meters(sampled[i - k], sampled[i + k]) < 30
    )
      k++;
    if (k < 5) continue;
    const start = i - k + 1,
      end = i + k - 1;
    backtracks.push({ start, end });
    movements.push({
      type: 'backtracking',
      segment: segmentIndex,
      startIndex: sampled[start].sourceIndex,
      endIndex: sampled[end].sourceIndex,
    });
    i = end;
  }
  // Bound spatial search and sampling so repeated long recordings stay practical in a worker.
  const overlapsBacktrack = (start: number, end: number) =>
    backtracks.some((b) => {
      const overlap =
        sampled[Math.min(end, b.end)].distance -
        sampled[Math.max(start, b.start)].distance;
      return (
        overlap >
        Math.max(60, (sampled[end].distance - sampled[start].distance) * 0.35)
      );
    });
  const cells = new Map<string, number>();
  const origin = sampled[0],
    cos = Math.max(0.001, Math.cos((origin.lat * Math.PI) / 180));
  const cell = (p: GPSPoint) => [
    Math.floor(
      ((((p.lon - origin.lon + 540) % 360) - 180) * 111195 * cos) / 25,
    ),
    Math.floor(((p.lat - origin.lat) * 111195) / 25),
  ];
  for (let i = 0; i < sampled.length; i++) {
    const [x, y] = cell(sampled[i]);
    let start = -1,
      nearest = 26;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const prior = cells.get(`${x + dx},${y + dy}`);
        if (
          prior === undefined ||
          sampled[i].distance - sampled[prior].distance < 120
        )
          continue;
        const d = meters(sampled[i], sampled[prior]);
        if (d < nearest) {
          nearest = d;
          start = prior;
        }
      }
    if (start >= 0 && nearest <= 25 && !overlapsBacktrack(start, i)) {
      const length = sampled[i].distance - sampled[start].distance,
        reference = signature(sampled.slice(start, i + 1));
      let end = i,
        loops = 1,
        compressedFrom: number | undefined;
      while (end < sampled.length - 2) {
        let candidate = -1,
          best = Infinity;
        for (
          let j = end + 1;
          j < sampled.length &&
          sampled[j].distance - sampled[end].distance <= length * 1.2;
          j++
        ) {
          if (sampled[j].distance - sampled[end].distance < length * 0.8)
            continue;
          const d = meters(sampled[start], sampled[j]);
          const score =
            d +
            Math.abs(sampled[j].distance - sampled[end].distance - length) *
              0.5;
          if (d <= 25 && score < best) {
            best = score;
            candidate = j;
          }
        }
        if (candidate < 0 || overlapsBacktrack(end, candidate)) break;
        const current = signature(sampled.slice(end, candidate + 1));
        const errors = current.map((p, n) => meters(p, reference[n]));
        if (
          errors.reduce((sum, d) => sum + d, 0) / errors.length > 25 ||
          Math.max(...errors) > 50
        )
          break;
        loops++;
        if (loops === 3) compressedFrom = sampled[end].sourceIndex;
        end = candidate;
      }
      if (loops > 1) {
        movements.push({
          type: 'loop',
          segment: segmentIndex,
          startIndex: sampled[start].sourceIndex,
          endIndex: sampled[end].sourceIndex,
          loopCount: loops,
          compressedFrom,
        });
        i = end;
        cells.clear();
      }
    }
    cells.set(`${x},${y}`, i);
  }
  return movements.sort((a, b) => a.startIndex - b.startIndex);
}
export function analyzeRoute(activity: Activity): ProcessedRoute {
  let filteredPoints = 0,
    distance = 0,
    duration = 0,
    timedEdges = 0,
    edges = 0,
    elevationEdges = 0,
    ascent = 0,
    descent = 0;
  const elevations: number[] = [];
  const segments = activity.segments.map((raw) => {
    const clean = raw
      .map((p, sourceIndex) => ({ ...p, sourceIndex }))
      .filter((p, i) => {
        if (!i || i === raw.length - 1) return true;
        const a = raw[i - 1],
          b = raw[i + 1],
          before = meters(a, p),
          after = meters(p, b),
          direct = meters(a, b);
        const dt1 = time(p) - time(a),
          dt2 = time(b) - time(p);
        const implausible =
          dt1 > 0 && dt2 > 0
            ? before / dt1 > 15 && after / dt2 > 15
            : Math.min(before, after) > 200;
        const spike =
          Math.min(before, after) > Math.max(60, direct * 4) && implausible;
        if (spike) filteredPoints++;
        return !spike;
      });
    return clean.map((p, i): RoutePoint => {
      const neighborhood = clean.slice(
        Math.max(0, i - 1),
        Math.min(clean.length, i + 2),
      );
      const elevation =
        p.elevation === undefined
          ? undefined
          : neighborhood.every((q) => q.elevation !== undefined) &&
              i > 0 &&
              i < clean.length - 1
            ? median(neighborhood.map((q) => q.elevation!))
            : p.elevation;
      if (elevation !== undefined) elevations.push(elevation);
      if (i) {
        distance += meters(clean[i - 1], p);
        edges++;
        const delta = time(p) - time(clean[i - 1]);
        if (Number.isFinite(delta) && delta > 0) {
          duration += delta;
          timedEdges++;
        }
      }
      return { ...p, elevation, distance };
    });
  });
  for (const segment of segments)
    for (let i = 1; i < segment.length; i++) {
      const a = segment[i - 1].elevation,
        b = segment[i].elevation;
      if (a === undefined || b === undefined) continue;
      elevationEdges++;
      ascent += Math.max(0, b - a);
      descent += Math.max(0, a - b);
    }
  const movements = segments.flatMap((s, i) => detectMovement(s, i));
  return {
    segments,
    movements,
    stats: {
      distance,
      duration: timedEdges ? duration : undefined,
      ascent: elevationEdges ? ascent : undefined,
      descent: elevationEdges ? descent : undefined,
      minElevation: elevations.length
        ? elevations.reduce((a, b) => Math.min(a, b), Infinity)
        : undefined,
      maxElevation: elevations.length
        ? elevations.reduce((a, b) => Math.max(a, b), -Infinity)
        : undefined,
      partialTime: timedEdges < edges,
      partialElevation:
        elevations.length < segments.reduce((n, s) => n + s.length, 0),
      filteredPoints,
    },
  };
}
