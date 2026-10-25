import {
  chartSamples,
  type ActivitySeries,
  type AnalysisSample,
} from './analysis';

export const chartMetrics = [
  {
    key: 'elevation',
    label: 'Elevation',
    unit: 'm',
    color: '#2b8c6b',
    dash: undefined,
  },
  { key: 'pace', label: 'Pace', unit: 'min/km', color: '#c76a23', dash: '8 3' },
  {
    key: 'heartRate',
    label: 'Heart rate',
    unit: 'bpm',
    color: '#b65271',
    dash: '3 3',
  },
  {
    key: 'temperature',
    label: 'Temperature',
    unit: '°C',
    color: '#438bb7',
    dash: '10 3 2 3',
  },
  {
    key: 'gradient',
    label: 'Gradient',
    unit: '%',
    color: '#9270c5',
    dash: '2 3',
  },
] as const;
export type ChartMetric = (typeof chartMetrics)[number];
export type MetricKey = ChartMetric['key'];
export type ChartRow = { distance: number; order: number } & Partial<
  Record<MetricKey, number | null>
>;
const sampleKey = (p: AnalysisSample) =>
  p.sourceIndex === undefined
    ? `gap:${p.distance}`
    : `${p.segmentIndex ?? 0}:${p.sourceIndex}:${p.distance}`;

// Downsample for drawing only; keep each metric's extrema and explicit gaps.
export function comparisonRows(
  series: ActivitySeries,
  keys: MetricKey[],
): ChartRow[] {
  const rows = new Map<string, ChartRow>();
  for (const key of keys)
    for (const p of chartSamples(series[key])) {
      if (!Number.isFinite(p.distance)) continue;
      rows.set(sampleKey(p), {
        distance: p.distance,
        order: p.sourceIndex ?? -1,
      });
    }
  for (const key of keys)
    for (let i = 0; i < series[key].length; i++) {
      const p = series[key][i];
      const row = rows.get(sampleKey(p));
      if (row) {
        row.order =
          p.sourceIndex ?? (series[key][i + 1]?.sourceIndex ?? i) - 0.5;
        row[key] =
          p.value !== undefined && Number.isFinite(p.value) ? p.value : null;
      }
    }
  return [...rows.values()].sort(
    (a, b) => a.distance - b.distance || a.order - b.order,
  );
}
export function metricRange(
  rows: ChartRow[],
  key: MetricKey,
): [number, number] {
  let min = Infinity,
    max = -Infinity;
  for (const row of rows) {
    const value = row[key];
    if (value != null) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }
  return min === Infinity ? [0, 0] : [min, max];
}
export function trendValue(
  value: number | null | undefined,
  [min, max]: [number, number],
) {
  return value == null
    ? null
    : min === max
      ? 50
      : ((value - min) / (max - min)) * 100;
}
export function nearestRow(rows: ChartRow[], distance: number) {
  let low = 0,
    high = rows.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (rows[mid].distance < distance) low = mid + 1;
    else high = mid;
  }
  return low > 0 &&
    distance - rows[low - 1].distance < rows[low].distance - distance
    ? low - 1
    : low;
}
