import { meters, type Activity, type GPSPoint } from './route';
export type RoutePoint = GPSPoint & {
  sourceIndex: number;
  distance: number;
  timestampMs?: number;
};
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
  movingTime?: number;
  movingDistance?: number;
  averageMovingPace?: number;
  elapsedPace?: number;
  averageSpeed?: number;
  averageMovingSpeed?: number;
  averageElapsedSpeed?: number;
  elapsedTime?: number;
  availability: Record<
    'timing' | 'elevation' | 'moving',
    { available: boolean; reason?: string }
  >;
  sensors: Partial<
    Record<
      'heartRate' | 'cadence' | 'power' | 'temperature',
      { average?: number; max?: number; coverage: number; reason?: string }
    >
  >;
  ascent?: number;
  descent?: number;
  minElevation?: number;
  maxElevation?: number;
  partialTime: boolean;
  partialElevation: boolean;
  filteredPoints: number;
};
export type AnalysisSample = {
  distance: number;
  value?: number;
  segmentIndex?: number;
  sourceIndex?: number;
  timestampMs?: number;
  elapsedSeconds?: number;
  edgeState?: 'moving' | 'stationary' | 'invalid' | 'unknown';
};
export function activityKind(type?: string) {
  const value = type?.toLowerCase() ?? '';
  return /cycl|bik/.test(value)
    ? 'cycling'
    : /trail.*run/.test(value)
      ? 'trail-running'
      : /run/.test(value)
        ? 'running'
        : /hik|trek/.test(value)
          ? 'hiking'
          : /walk/.test(value)
            ? 'walking'
            : 'unknown';
}
export type ActivitySeries = {
  elevation: AnalysisSample[];
  speed: AnalysisSample[];
  pace: AnalysisSample[];
  heartRate: AnalysisSample[];
  cadence: AnalysisSample[];
  power: AnalysisSample[];
  gradient: AnalysisSample[];
  temperature: AnalysisSample[];
};
export type DistanceSplit = {
  kilometer: number;
  distance: number;
  partial: boolean;
  movingDistance: number;
  ascent?: number;
  heartRate?: number;
  duration?: number;
  pace?: number;
};
export type ProcessedRoute = {
  segments: RoutePoint[][];
  movements: Movement[];
  stats: RouteStats;
  series: ActivitySeries;
  chartSeries: ActivitySeries;
  splits: DistanceSplit[];
};
export function timestamp(value?: string): number {
  if (
    !value ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  )
    return NaN;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? Date.parse(value)
    : NaN;
}
const time = (p: GPSPoint & { timestampMs?: number }) =>
  (p.timestampMs ?? timestamp(p.time)) / 1000;
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
// Keep bucket extrema and gap boundaries; source-resolution series remain available.
export function chartSamples(
  samples: AnalysisSample[],
  budget = 1500,
): AnalysisSample[] {
  if (samples.length <= budget) return samples;
  const result: AnalysisSample[] = [];
  const size = Math.ceil(samples.length / (budget / 4));
  for (let start = 0; start < samples.length; start += size) {
    const end = Math.min(samples.length, start + size);
    const keep = new Set([start, end - 1]);
    let min = start,
      max = start;
    for (let i = start; i < end; i++) {
      const value = samples[i].value;
      if (value === undefined) {
        if (i && samples[i - 1].value !== undefined) {
          keep.add(i - 1);
          keep.add(i);
        }
        if (i + 1 < samples.length && samples[i + 1].value !== undefined) {
          keep.add(i);
          keep.add(i + 1);
        }
      } else {
        if (samples[min].value === undefined || value < samples[min].value!)
          min = i;
        if (samples[max].value === undefined || value > samples[max].value!)
          max = i;
      }
    }
    keep.add(min);
    keep.add(max);
    for (const i of [...keep].sort((a, b) => a - b))
      if (result.at(-1) !== samples[i]) result.push(samples[i]);
  }
  return result;
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
      .map((p, sourceIndex) => ({
        ...p,
        sourceIndex,
        timestampMs: timestamp(p.time),
      }))
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
  const movements = segments.flatMap((s, i) => detectMovement(s, i));
  const series: ActivitySeries = {
    elevation: [],
    speed: [],
    pace: [],
    heartRate: [],
    cadence: [],
    power: [],
    gradient: [],
    temperature: [],
  };
  const splits: DistanceSplit[] = [];
  const invalidSplits = new Set<number>();
  const stationaryCoverage = new Map<
    number,
    { time: number; hrTime: number; hrSum: number }
  >();
  const splitCoverage: {
    known: number;
    hrTime: number;
    hrSum: number;
    elevation: boolean;
    recordedTime: number;
  }[] = [];
  const sensorTotals = Object.fromEntries(
    ['heartRate', 'cadence', 'power', 'temperature'].map((key) => [
      key,
      { sum: 0, seconds: 0, count: 0, max: -Infinity },
    ]),
  );
  let movingTime = 0,
    movingDistance = 0;
  const completeTime = timedEdges === edges && edges > 0;
  const completeMovement =
    completeTime &&
    segments.every((segment) =>
      segment.every((p, i) => !i || time(p) - time(segment[i - 1]) <= 300),
    );
  const all = segments.flat();
  const presentSensors = new Set<keyof ActivitySeries>(
    ['heartRate', 'cadence', 'power', 'temperature'].filter((key) =>
      all.some((p) => p[key as keyof GPSPoint] !== undefined),
    ) as (keyof ActivitySeries)[],
  );
  const chronological = all.every((p, i) => !i || time(p) >= time(all[i - 1]));
  const elapsedTime =
    completeTime && chronological
      ? time(all.at(-1)!) - time(all[0])
      : undefined;
  segments.forEach((segment, segmentIndex) => {
    const resting = new Uint8Array(segment.length);
    for (const m of movements)
      if (m.segment === segmentIndex && m.type === 'stay')
        resting.fill(1, m.startIndex + 1, m.endIndex + 1);
    let elevationAnchor: number | undefined;
    let gradeStart = 0,
      speedStart = 0;
    let windowDistance = 0,
      windowTime = 0;
    const edgeDistance = new Float64Array(segment.length);
    const edgeTime = new Float64Array(segment.length);
    for (let i = 0; i < segment.length; i++) {
      const p = segment[i],
        previous = segment[i - 1];
      const edge = previous ? p.distance - previous.distance : 0;
      const dt = previous ? time(p) - time(previous) : NaN;
      const valid = Number.isFinite(dt) && dt > 0 && dt <= 300;
      const moving =
        valid && !resting[i] && edge / dt >= 0.3 && edge / dt <= 100;
      if (moving) {
        movingTime += dt;
        movingDistance += edge;
      }
      const add = (key: keyof ActivitySeries, value?: number) => {
        if (
          ['heartRate', 'cadence', 'power', 'temperature'].includes(key) &&
          !presentSensors.has(key)
        )
          return;
        if (!i && segmentIndex) series[key].push({ distance: p.distance });
        series[key].push({
          distance: p.distance,
          value,
          segmentIndex,
          sourceIndex: p.sourceIndex,
          timestampMs: Number.isFinite(time(p)) ? time(p) * 1000 : undefined,
          elapsedSeconds:
            Number.isFinite(time(p)) && Number.isFinite(time(all[0]))
              ? time(p) - time(all[0])
              : undefined,
          edgeState:
            !previous || !Number.isFinite(dt)
              ? 'unknown'
              : !valid
                ? 'invalid'
                : moving
                  ? 'moving'
                  : 'stationary',
        });
      };
      let elevationDelta = 0;
      if (p.elevation === undefined) {
        elevationAnchor = undefined;
        gradeStart = i + 1;
      } else if (elevationAnchor === undefined) elevationAnchor = p.elevation;
      else if (Math.abs(p.elevation - elevationAnchor) >= 3) {
        elevationDelta = p.elevation - elevationAnchor;
        ascent += Math.max(0, elevationDelta);
        descent += Math.max(0, -elevationDelta);
        elevationAnchor = p.elevation;
      }
      if (previous?.elevation !== undefined && p.elevation !== undefined)
        elevationEdges++;
      while (
        gradeStart < i - 1 &&
        p.distance - segment[gradeStart + 1].distance >= 30
      )
        gradeStart++;
      const gradeDistance =
        p.distance - (segment[gradeStart]?.distance ?? p.distance);
      add(
        'gradient',
        gradeDistance >= 30 &&
          p.elevation !== undefined &&
          segment[gradeStart]?.elevation !== undefined
          ? (100 * (p.elevation - segment[gradeStart].elevation!)) /
              gradeDistance
          : undefined,
      );
      add('elevation', p.elevation);
      if (!moving) {
        speedStart = i;
        windowDistance = 0;
        windowTime = 0;
      } else {
        edgeDistance[i] = edge;
        edgeTime[i] = dt;
        windowDistance += edge;
        windowTime += dt;
        while (
          speedStart < i - 1 &&
          windowDistance - edgeDistance[speedStart + 1] >= 50
        ) {
          speedStart++;
          windowDistance -= edgeDistance[speedStart];
          windowTime -= edgeTime[speedStart];
        }
      }
      const speed =
        moving && windowTime > 0 && windowDistance >= 30
          ? windowDistance / windowTime
          : undefined;
      add('speed', speed === undefined ? undefined : speed * 3.6);
      add('pace', speed === undefined ? undefined : 1000 / speed);
      for (const key of [
        'heartRate',
        'cadence',
        'power',
        'temperature',
      ] as const) {
        const supported = key !== 'cadence' || p.cadenceType === 'cycling';
        const powerSupported =
          key !== 'power' || activityKind(activity.type) === 'cycling';
        const value = supported && powerSupported ? p[key] : undefined;
        if (
          presentSensors.has(key) &&
          previous &&
          ((Number.isFinite(dt) && dt > 60) ||
            ((p.time || previous.time) && !valid))
        )
          series[key].push({ distance: p.distance });
        add(key, value);
        const total = sensorTotals[key];
        if (value !== undefined && Number.isFinite(value)) {
          total.count++;
          total.max = Math.max(total.max, value);
          if (valid && dt <= 60 && previous?.[key] !== undefined) {
            total.sum += ((previous[key]! + value) / 2) * dt;
            total.seconds += dt;
          }
        }
      }
      if (previous && edge === 0 && distance > 0) {
        const index = Math.min(
          Math.floor(p.distance / 1000),
          Math.ceil(distance / 1000) - 1,
        );
        if (!valid) invalidSplits.add(index);
        else {
          const coverage = stationaryCoverage.get(index) ?? {
            time: 0,
            hrTime: 0,
            hrSum: 0,
          };
          coverage.time += dt;
          if (
            dt <= 60 &&
            previous.heartRate !== undefined &&
            p.heartRate !== undefined
          ) {
            coverage.hrTime += dt;
            coverage.hrSum += ((previous.heartRate + p.heartRate) / 2) * dt;
          }
          stationaryCoverage.set(index, coverage);
        }
      }
      let cursor = previous?.distance ?? p.distance;
      while (cursor < p.distance) {
        const index = Math.floor(cursor / 1000);
        const boundary = Math.min(p.distance, (index + 1) * 1000);
        const portion = boundary - cursor,
          fraction = portion / edge;
        const split = (splits[index] ??= {
          kilometer: index + 1,
          distance: 0,
          partial: false,
          movingDistance: 0,
          duration: 0,
        });
        const coverage = (splitCoverage[index] ??= {
          known: 0,
          hrTime: 0,
          hrSum: 0,
          elevation: false,
          recordedTime: 0,
        });
        split.distance += portion;
        if (valid) {
          coverage.known += portion;
          coverage.recordedTime += dt * fraction;
        }
        if (moving) {
          split.duration! += dt * fraction;
          split.movingDistance += portion;
        }
        if (previous?.elevation !== undefined && p.elevation !== undefined) {
          coverage.elevation = true;
          split.ascent =
            (split.ascent ?? 0) + Math.max(0, elevationDelta) * fraction;
        }
        if (
          valid &&
          dt <= 60 &&
          previous?.heartRate !== undefined &&
          p.heartRate !== undefined
        ) {
          coverage.hrTime += dt * fraction;
          coverage.hrSum +=
            ((previous.heartRate + p.heartRate) / 2) * dt * fraction;
        }
        cursor = boundary;
      }
    }
  });
  splits.forEach((split, i) => {
    const coverage = splitCoverage[i];
    const stationary = stationaryCoverage.get(i);
    if (stationary) {
      coverage.recordedTime += stationary.time;
      coverage.hrTime += stationary.hrTime;
      coverage.hrSum += stationary.hrSum;
    }
    split.partial = split.distance < 999.99;
    if (invalidSplits.has(i) || coverage.known < split.distance - 0.001)
      split.duration = undefined;
    if (
      split.duration !== undefined &&
      split.duration > 0 &&
      split.movingDistance > 0
    )
      split.pace = split.duration / (split.movingDistance / 1000);
    if (
      coverage.recordedTime > 0 &&
      coverage.hrTime / coverage.recordedTime >= 0.8
    )
      split.heartRate = coverage.hrSum / coverage.hrTime;
  });
  const sensors: RouteStats['sensors'] = {};
  for (const key of ['heartRate', 'cadence', 'power', 'temperature'] as const) {
    const total = sensorTotals[key];
    const coverage = duration > 0 ? total.seconds / duration : 0;
    sensors[key] = {
      coverage,
      max: total.count ? total.max : undefined,
      average:
        completeTime && coverage >= 0.8 && total.count >= 2
          ? total.sum / total.seconds
          : undefined,
      reason: !total.count
        ? 'missing-data'
        : !completeTime || coverage < 0.8
          ? 'insufficient-coverage'
          : undefined,
    };
  }
  const chartSeries = Object.fromEntries(
    Object.entries(series).map(([key, samples]) => [
      key,
      chartSamples(samples),
    ]),
  ) as ActivitySeries;
  return {
    segments,
    movements,
    series,
    chartSeries,
    splits,
    stats: {
      distance,
      duration: timedEdges ? duration : undefined,
      elapsedTime,
      movingTime: completeMovement ? movingTime : undefined,
      movingDistance: completeMovement ? movingDistance : undefined,
      averageMovingPace:
        completeMovement && movingDistance > 0 && movingTime > 0
          ? movingTime / (movingDistance / 1000)
          : undefined,
      averageMovingSpeed:
        completeMovement && movingTime > 0
          ? movingDistance / movingTime
          : undefined,
      elapsedPace:
        elapsedTime && distance > 0
          ? elapsedTime / (distance / 1000)
          : undefined,
      averageElapsedSpeed:
        elapsedTime && distance > 0 ? distance / elapsedTime : undefined,
      averageSpeed:
        completeTime && duration > 0 ? distance / duration : undefined,
      ascent: elevationEdges ? ascent : undefined,
      descent: elevationEdges ? descent : undefined,
      minElevation: elevations.length
        ? elevations.reduce((a, b) => Math.min(a, b), Infinity)
        : undefined,
      maxElevation: elevations.length
        ? elevations.reduce((a, b) => Math.max(a, b), -Infinity)
        : undefined,
      partialTime: !completeTime,
      partialElevation: elevations.length < all.length,
      filteredPoints,
      sensors,
      availability: {
        timing: {
          available: completeTime,
          reason: completeTime
            ? undefined
            : timedEdges
              ? 'insufficient-coverage'
              : 'missing-data',
        },
        elevation: {
          available: elevationEdges > 0,
          reason: elevationEdges
            ? undefined
            : elevations.length
              ? 'insufficient-coverage'
              : 'missing-data',
        },
        moving: {
          available: completeMovement && movingTime > 0,
          reason: !completeMovement
            ? 'insufficient-coverage'
            : movingTime <= 0
              ? 'insufficient-duration'
              : undefined,
        },
      },
    },
  };
}
