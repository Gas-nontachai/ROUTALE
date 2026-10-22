import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { normalizeGpx } from './gpxSensors';
import { clamp, angleDelta, motionProfile } from './motion';
import { analyzeRoute, type ProcessedRoute } from './analysis';
export type GPSPoint = {
  lat: number;
  lon: number;
  elevation?: number;
  time?: string;
  heartRate?: number;
  cadence?: number;
  cadenceType?: 'running' | 'cycling' | 'unknown';
  temperature?: number;
  power?: number;
  speed?: number;
};
export type Point = {
  x: number;
  y: number;
  distance: number;
  elevation?: number;
  sourceIndex?: number;
  sourceSegment?: number;
};
export type Activity = {
  name: string;
  type?: string;
  unsupportedExtensions?: boolean;
  description?: string;
  recordedAt?: string;
  count: number;
  segments: GPSPoint[][];
  distance: number;
  ascent: number;
  seed: number;
};
export type Spot = Point & {
  id: string;
  type: 'start' | 'finish' | 'rest' | 'loop' | 'summit';
  label: string;
  duration?: number;
  loopCount?: number;
};
export type AnimationStep = {
  from: Point;
  to: Point;
  start: number;
  end: number;
  type: 'normal' | 'stay' | 'loop' | 'backtracking';
  spotId?: string;
};
export type World = {
  width: number;
  height: number;
  segments: Point[][];
  spots: Spot[];
  distance: number;
  seed: number;
  processed: ProcessedRoute;
  steps: AnimationStep[];
  duration: number;
  projection: {
    lat: number;
    lon: number;
    cos: number;
    scale: number;
    centerX: number;
    centerY: number;
  };
};

const list = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];
const radians = (n: number) => (n * Math.PI) / 180;
export function meters(a: GPSPoint, b: GPSPoint) {
  const h =
    Math.sin(radians(b.lat - a.lat) / 2) ** 2 +
    Math.cos(radians(a.lat)) *
      Math.cos(radians(b.lat)) *
      Math.sin(radians(b.lon - a.lon) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function parseGpx(
  xml: string,
  filename = 'Untitled adventure',
): Activity {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error('GPX files with document entities are not supported.');
  if (XMLValidator.validate(xml) !== true)
    throw new Error('This file is not valid GPX XML.');
  const root = normalizeGpx(
    new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: false,
      parseAttributeValue: false,
    }).parse(xml),
  ).gpx;
  if (!root) throw new Error('Choose a GPX file with a <gpx> root.');
  const tracks = list<any>(root.trk);
  const raw = tracks.flatMap((t) =>
    list<any>(t.trkseg).map((s) => list<any>(s.trkpt)),
  );
  if (!raw.length)
    raw.push(...list<any>(root.rte).map((r) => list<any>(r.rtept)));
  const segments: GPSPoint[][] = [];
  let unsupportedExtensions = false;
  let count = 0,
    distance = 0,
    ascent = 0;
  for (const segment of raw) {
    let valid: GPSPoint[] = [];
    const flush = () => {
      if (valid.length > 1) segments.push(valid);
      valid = [];
    };
    for (const p of segment) {
      const lat = Number(p['@_lat']),
        lon = Number(p['@_lon']);
      if (
        p['@_lat'] === undefined ||
        p['@_lon'] === undefined ||
        String(p['@_lat']).trim() === '' ||
        String(p['@_lon']).trim() === '' ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        Math.abs(lat) > 90 ||
        Math.abs(lon) > 180
      ) {
        flush();
        continue;
      }
      const point: GPSPoint = { lat, lon };
      if (
        p.ele !== undefined &&
        String(p.ele).trim() !== '' &&
        Number.isFinite(Number(p.ele))
      )
        point.elevation = Number(p.ele);
      if (typeof p.time === 'string') point.time = p.time;
      Object.assign(point, p.extensions?.sensors);
      unsupportedExtensions ||= Boolean(p.extensions?.unsupported);
      if (point.cadence !== undefined) {
        const type = String(
          tracks[0]?.type || list<any>(root.rte)[0]?.type || '',
        ).toLowerCase();
        point.cadenceType = /cycl|bik/.test(type)
          ? 'cycling'
          : /run/.test(type)
            ? 'running'
            : 'unknown';
      }
      valid.push(point);
      if (++count > 300000)
        throw new Error(
          'This track exceeds 300,000 points. Please split it into smaller GPX files.',
        );
    }
    flush();
  }
  count = 0;
  for (const segment of segments) {
    count += segment.length;
    for (let i = 1; i < segment.length; i++) {
      distance += meters(segment[i - 1], segment[i]);
      if (
        segment[i].elevation !== undefined &&
        segment[i - 1].elevation !== undefined
      )
        ascent += Math.max(
          0,
          segment[i].elevation! - segment[i - 1].elevation!,
        );
    }
  }
  if (!segments.length || distance < 1)
    throw new Error(
      'No walkable route found. Include at least two different, valid GPS coordinates.',
    );
  let seed = 2166136261;
  for (let i = 0; i < xml.length; i++)
    seed = Math.imul(seed ^ xml.charCodeAt(i), 16777619);
  return {
    name: String(
      tracks[0]?.name ||
        root.metadata?.name ||
        list<any>(root.rte)[0]?.name ||
        filename.replace(/\.gpx$/i, ''),
    ),
    type: String(tracks[0]?.type || list<any>(root.rte)[0]?.type || ''),
    unsupportedExtensions,
    description: root.metadata?.desc ? String(root.metadata.desc) : undefined,
    recordedAt:
      typeof root.metadata?.time === 'string' ? root.metadata.time : undefined,
    count,
    segments,
    distance,
    ascent,
    seed: seed >>> 0,
  };
}
function simplify(points: Point[], tolerance = 1): Point[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    const a = points[start],
      b = points[end],
      dx = b.x - a.x,
      dy = b.y - a.y,
      length = dx * dx + dy * dy;
    let max = tolerance * tolerance,
      index = -1;
    for (let i = start + 1; i < end; i++) {
      const p = points[i],
        t = length
          ? Math.max(
              0,
              Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length),
            )
          : 0;
      const heightError =
        p.elevation !== undefined &&
        a.elevation !== undefined &&
        b.elevation !== undefined
          ? Math.abs(
              p.elevation - a.elevation - t * (b.elevation - a.elevation),
            ) / 2
          : 0;
      const d = Math.max(
        (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2,
        heightError ** 2,
      );
      if (d > max) {
        max = d;
        index = i;
      }
    }
    if (index >= 0) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
export function createWorld(activity: Activity): World {
  const processed = analyzeRoute(activity);
  if (processed.stats.distance < 1)
    throw new Error(
      'No walkable route remains after filtering GPS noise. Please try a different GPX export.',
    );
  const first = activity.segments[0][0];
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    distance = 0;
  // shortcut: local projection suits activity-scale routes; use a global projection for transcontinental tracks.
  const cos = Math.max(0.001, Math.cos(radians(first.lat)));
  const projected = processed.segments.map((segment, sourceSegment) => {
    let longitude = first.lon;
    return segment.map((p, i) => {
      longitude += ((p.lon - longitude + 540) % 360) - 180;
      const x = radians(longitude - first.lon) * 6371000 * cos,
        y = -radians(p.lat - first.lat) * 6371000;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      if (i) distance += meters(segment[i - 1], p);
      return {
        x,
        y,
        distance: p.distance,
        elevation: p.elevation,
        sourceIndex: p.sourceIndex,
        sourceSegment,
      };
    });
  });
  const scale = 1400 / Math.max(maxX - minX, maxY - minY, 1);
  const width = Math.max(1100, (maxX - minX) * scale + 400),
    height = Math.max(1000, (maxY - minY) * scale + 400);
  const projection = {
    lat: first.lat,
    lon: first.lon,
    cos,
    scale,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
  const full: Point[][] = projected.map((s) =>
    s.map((p) => ({
      ...p,
      x: (p.x - projection.centerX) * scale + width / 2,
      y: (p.y - projection.centerY) * scale + height / 2,
    })),
  );
  const world: World = {
    width,
    height,
    segments: [],
    distance: processed.stats.distance,
    seed: activity.seed,
    spots: [],
    processed,
    projection,
    steps: [],
    duration: 0,
  };
  const start = full[0][0],
    last = full[full.length - 1].at(-1)!;
  world.spots.push(
    { ...start, id: 'start', type: 'start', label: 'Start' },
    { ...last, id: 'finish', type: 'finish', label: 'Finish' },
  );
  const highest = full
    .flat()
    .filter((p) => p.elevation !== undefined)
    .reduce<Point | undefined>(
      (a, p) => (!a || p.elevation! > a.elevation! ? p : a),
      undefined,
    );
  if (highest)
    world.spots.push({
      ...highest,
      id: 'high-point',
      type: 'summit',
      label: 'Track high point',
    });
  for (const [n, m] of processed.movements.entries()) {
    if (m.type === 'backtracking') continue;
    const p = full[m.segment][m.startIndex];
    world.spots.push({
      ...p,
      id: `movement-${n}`,
      type: m.type === 'stay' ? 'rest' : 'loop',
      label: m.type === 'stay' ? 'Rest area' : `${m.loopCount} laps`,
      duration: m.duration,
      loopCount: m.loopCount,
    });
  }
  const order = { start: 0, rest: 1, loop: 2, summit: 3, finish: 4 };
  world.spots.sort(
    (a, b) => a.distance - b.distance || order[a.type] - order[b.type],
  );
  const append = (
    from: Point,
    to: Point,
    duration: number,
    type: AnimationStep['type'],
    spotId?: string,
  ) => {
    world.steps.push({
      from,
      to,
      start: world.duration,
      end: world.duration + duration,
      type,
      spotId,
    });
    world.duration += duration;
  };
  full.forEach((segment, segmentIndex) => {
    const movements = processed.movements.filter(
      (m) => m.segment === segmentIndex,
    );
    const indices = new Map(segment.map((p, i) => [p, i]));
    const protectedIndices = new Set([0, segment.length - 1]);
    for (const m of movements) {
      protectedIndices.add(m.startIndex);
      protectedIndices.add(m.endIndex);
      if (m.compressedFrom !== undefined)
        protectedIndices.add(m.compressedFrom);
    }
    if (highest) {
      const i = segment.indexOf(highest);
      if (i >= 0) protectedIndices.add(i);
    }
    for (let i = 1; i < segment.length; i++)
      if (
        (segment[i].elevation === undefined) !==
        (segment[i - 1].elevation === undefined)
      ) {
        protectedIndices.add(i - 1);
        protectedIndices.add(i);
      }
    const boundaries = [...protectedIndices].sort((a, b) => a - b);
    const simplified = boundaries
      .slice(1)
      .flatMap((end, n) =>
        simplify(segment.slice(boundaries[n], end + 1)).slice(n ? 1 : 0),
      );
    world.segments.push(simplified);
    let i = 0;
    while (i < simplified.length - 1) {
      const p = simplified[i],
        index = indices.get(p)!;
      const stay = movements.find(
        (m) => m.type === 'stay' && m.startIndex === index,
      );
      if (stay) {
        const end = segment[stay.endIndex],
          target = simplified.indexOf(end);
        const spot = world.spots.find(
          (s) => s.type === 'rest' && s.distance === p.distance,
        );
        append(p, { ...p, distance: end.distance }, 2, 'stay', spot?.id);
        if (Math.hypot(end.x - p.x, end.y - p.y) > 0.1)
          append(
            { ...p, distance: end.distance },
            end,
            Math.max(
              0.1,
              meters(
                processed.segments[segmentIndex][stay.startIndex],
                processed.segments[segmentIndex][stay.endIndex],
              ) / 85,
            ),
            'normal',
          );
        i = target;
        continue;
      }
      const to = simplified[i + 1];
      const backtracking = movements.some(
        (m) =>
          m.type === 'backtracking' &&
          index >= m.startIndex &&
          index < m.endIndex,
      );
      const loop = movements.find(
        (m) =>
          m.type === 'loop' &&
          m.compressedFrom !== undefined &&
          index >= m.compressedFrom &&
          index < m.endIndex,
      );
      append(
        p,
        to,
        Math.max(
          0.001,
          (to.distance - p.distance) / (85 * (loop && !backtracking ? 12 : 1)),
        ),
        backtracking ? 'backtracking' : loop ? 'loop' : 'normal',
      );
      i++;
    }
  });
  let turns = 0;
  for (const segment of world.segments)
    for (let i = 1; i < segment.length - 1; i++) {
      const a = segment[i - 1],
        b = segment[i],
        c = segment[i + 1];
      const before = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      const after = (Math.atan2(c.y - b.y, c.x - b.x) * 180) / Math.PI;
      turns += Math.min(1, Math.abs(angleDelta(before, after)) / 90);
    }
  const target = clamp(
    15 +
      Math.sqrt(world.distance) * 0.6 +
      Math.sqrt(turns) * 3 +
      Math.sqrt(processed.stats.ascent ?? 0) +
      world.spots.length * 0.5 +
      processed.movements.filter((m) => m.type === 'stay').length * 2,
    motionProfile.minPlayback,
    motionProfile.maxPlayback,
  );
  const stays = world.steps.filter((s) => s.type === 'stay').length;
  const dwell = Math.min(2, (target / Math.max(1, stays)) * 0.25);
  const movingDuration = world.steps
    .filter((s) => s.type !== 'stay')
    .reduce((sum, s) => sum + s.end - s.start, 0);
  const factor = (target - stays * dwell) / (movingDuration || 1);
  let cursor = 0;
  for (const step of world.steps) {
    const duration =
      step.type === 'stay' ? dwell : (step.end - step.start) * factor;
    step.start = cursor;
    cursor += duration;
    step.end = cursor;
  }
  world.steps.at(-1)!.end = target;
  world.duration = target;
  return world;
}
export function positionAt(world: World, distance: number): Point {
  const segment =
    world.segments.find((s) => s[s.length - 1].distance > distance) ??
    world.segments[world.segments.length - 1];
  if (distance <= segment[0].distance) return segment[0];
  let lo = 1,
    hi = segment.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (segment[mid].distance < distance) lo = mid + 1;
    else hi = mid;
  }
  const a = segment[lo - 1],
    b = segment[lo],
    t = Math.min(
      1,
      Math.max(0, (distance - a.distance) / (b.distance - a.distance || 1)),
    );
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    distance,
    elevation:
      a.elevation !== undefined && b.elevation !== undefined
        ? a.elevation + (b.elevation - a.elevation) * t
        : undefined,
  };
}
export function random(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function animationAt(world: World, elapsed: number) {
  let lo = 0,
    hi = world.steps.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (world.steps[mid].end <= elapsed) lo = mid + 1;
    else hi = mid;
  }
  const step = world.steps[lo],
    t = Math.max(
      0,
      Math.min(1, (elapsed - step.start) / (step.end - step.start)),
    );
  const a = step.from,
    b = step.to;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    distance: a.distance + (b.distance - a.distance) * t,
    elevation:
      a.elevation !== undefined && b.elevation !== undefined
        ? a.elevation + (b.elevation - a.elevation) * t
        : undefined,
    movement: step.type,
    spotId: step.spotId,
  };
}
export function projectGeo(world: World, p: GPSPoint): Point {
  const projection = world.projection;
  const longitude = ((p.lon - projection.lon + 540) % 360) - 180;
  return {
    x:
      (radians(longitude) * 6371000 * projection.cos - projection.centerX) *
        projection.scale +
      world.width / 2,
    y:
      (-radians(p.lat - projection.lat) * 6371000 - projection.centerY) *
        projection.scale +
      world.height / 2,
    distance: 0,
    elevation: p.elevation,
  };
}
export function unproject(world: World, x: number, y: number): GPSPoint {
  const p = world.projection;
  return {
    lat:
      p.lat -
      ((((y - world.height / 2) / p.scale + p.centerY) / 6371000) * 180) /
        Math.PI,
    lon:
      ((p.lon +
        ((((x - world.width / 2) / p.scale + p.centerX) / (6371000 * p.cos)) *
          180) /
          Math.PI +
        540) %
        360) -
      180,
  };
}
