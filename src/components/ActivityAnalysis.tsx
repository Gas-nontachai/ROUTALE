import {
  ChartNoAxesCombined,
  CircleHelp,
  HeartPulse,
  Mountain,
  Pin,
  Thermometer,
  Timer,
  TrendingUp,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { paceLabel } from '../lib/format';
import type { ActivitySeries } from '../lib/analysis';
import {
  chartMetrics,
  comparisonRows,
  metricRange,
  nearestRow,
  trendValue,
  type MetricKey,
  type ChartMetric,
} from '../lib/chartComparison';

const metricIcons = {
  elevation: Mountain,
  pace: Timer,
  heartRate: HeartPulse,
  temperature: Thermometer,
  gradient: TrendingUp,
};

const valueLabel = (value: number | null | undefined, metric: ChartMetric) =>
  value == null
    ? '—'
    : metric.key === 'pace'
      ? paceLabel(value)
      : `${value.toFixed(1)} ${metric.unit}`;

export function ActivityAnalysis({
  series,
  distance,
}: {
  series: ActivitySeries;
  distance: number;
  activityType?: string;
}) {
  const available = useMemo(
    () =>
      chartMetrics.filter(({ key }) =>
        series[key].some(
          (p) => p.value !== undefined && Number.isFinite(p.value),
        ),
      ),
    [series],
  );
  const [selection, setSelection] = useState<MetricKey[] | null>(null);
  const selected = available.filter(({ key }) =>
    selection === null ? key === available[0]?.key : selection.includes(key),
  );
  const keys = selected.map((m) => m.key);
  const keySignature = keys.join(',');
  const rows = useMemo(
    () =>
      comparisonRows(
        series,
        keySignature.split(',').filter(Boolean) as MetricKey[],
      ),
    [series, keySignature],
  );
  const ranges = useMemo(
    () =>
      Object.fromEntries(
        keys.map((key) => [key, metricRange(rows, key)]),
      ) as Record<MetricKey, [number, number]>,
    [rows, keySignature],
  );
  const compare = selected.length >= 3;
  const data = useMemo(
    () =>
      rows.map((row) =>
        Object.fromEntries([
          ['distance', row.distance],
          ...keys.map((key) => [
            key,
            compare
              ? trendValue(row[key], ranges[key])
              : row[key] == null
                ? null
                : key === 'pace'
                  ? row[key]! / 60
                  : row[key],
          ]),
        ]),
      ),
    [rows, compare, ranges, keySignature],
  );
  const [active, setActive] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);
  const index =
    active === null || !rows.length ? null : Math.min(active, rows.length - 1);
  const sample = index === null ? undefined : rows[index];
  if (!available.length) return null;
  const inspect = (element: HTMLDivElement, clientX: number) => {
    if (!rows.length) return;
    const rect = element.getBoundingClientRect();
    const fraction = Math.max(
      0,
      Math.min(1, (clientX - rect.left - 64) / Math.max(1, rect.width - 128)),
    );
    setActive(nearestRow(rows, fraction * distance));
  };
  return (
    <section className="ui-panel" aria-label="Explore the data">
      <h3 className="flex items-center gap-2 text-xl font-bold">
        <ChartNoAxesCombined size={20} aria-hidden="true" /> Explore
      </h3>
      <fieldset className="my-3 flex flex-wrap gap-x-6 gap-y-1">
        <legend className="sr-only">Select up to five metrics</legend>
        {available.map((metric) => {
          const Icon = metricIcons[metric.key];
          return (
            <label
              key={metric.key}
              className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium"
            >
              <input
                type="checkbox"
                className="size-4"
                checked={keys.includes(metric.key)}
                onChange={() => {
                  setSelection(
                    keys.includes(metric.key)
                      ? keys.filter((key) => key !== metric.key)
                      : [...keys, metric.key],
                  );
                  setActive(null);
                  setPinned(false);
                }}
              />
              <Icon
                size={16}
                style={{ color: metric.color }}
                aria-hidden="true"
              />
              {metric.label}
            </label>
          );
        })}
      </fieldset>
      {selected.length === 0 ? (
        <p className="ui-notice">Select a metric.</p>
      ) : (
        <>
          <p className="mb-3 text-xs font-medium text-muted">
            {compare
              ? 'Trends · 0–100% per metric, not measured units.'
              : selected.map((m) => `${m.label} (${m.unit})`).join(' · ')}{' '}
            {keys.includes('pace') && 'Higher pace = slower.'}
          </p>
          {selected
            .filter((m) => ranges[m.key][0] === ranges[m.key][1])
            .map((m) => (
              <p key={m.key} className="text-xs text-muted">
                {m.label}: {valueLabel(ranges[m.key][0], m)} (constant).
              </p>
            ))}
          <div
            className="relative h-72 w-full touch-pan-y"
            role="group"
            aria-label="Route metric inspector. Arrow keys explore; Enter pins; Escape clears."
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setActive(null);
                setPinned(false);
              } else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setActive(index ?? 0);
                setPinned(!pinned);
              } else if (
                ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
              ) {
                event.preventDefault();
                setActive(
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? rows.length - 1
                      : Math.max(
                          0,
                          Math.min(
                            rows.length - 1,
                            (index ?? 0) +
                              (event.key === 'ArrowRight' ? 1 : -1),
                          ),
                        ),
                );
              }
            }}
            onPointerMove={(event) => {
              if (!pinned || event.pointerType === 'touch')
                inspect(event.currentTarget, event.clientX);
            }}
            onPointerLeave={() => {
              if (!pinned) setActive(null);
            }}
            onPointerDown={(event) => {
              inspect(event.currentTarget, event.clientX);
              if (event.pointerType === 'touch') {
                event.currentTarget.setPointerCapture(event.pointerId);
              }
            }}
            onClick={(event) => {
              if (event.detail) setPinned(!pinned);
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                accessibilityLayer={false}
                margin={{ top: 16, right: 0, left: 0, bottom: 4 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--ui-line)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  type="number"
                  dataKey="distance"
                  domain={[0, distance]}
                  tickFormatter={(v) => (Number(v) / 1000).toFixed(1)}
                  tick={{ fontSize: 12, fill: 'var(--ui-muted)' }}
                />
                {(compare ? [selected[0]] : selected).map((metric, i) => (
                  <YAxis
                    key={metric.key}
                    yAxisId={compare ? 'compare' : metric.key}
                    orientation={i === 1 ? 'right' : 'left'}
                    width={64}
                    domain={
                      compare
                        ? [0, 100]
                        : (() => {
                            const [min, max] = ranges[metric.key];
                            const pad = Math.max(
                              (max - min) * 0.05,
                              metric.key === 'pace' ? 1 : 0.5,
                            );
                            const scale = metric.key === 'pace' ? 60 : 1;
                            return [(min - pad) / scale, (max + pad) / scale];
                          })()
                    }
                    unit={compare ? '%' : undefined}
                    tick={{
                      fontSize: 12,
                      fill: compare ? 'var(--ui-muted)' : metric.color,
                    }}
                    tickFormatter={(v) =>
                      metric.key === 'pace' && !compare
                        ? paceLabel(Number(v) * 60).replace(' /km', '')
                        : String(Number(Number(v).toFixed(1)))
                    }
                  />
                ))}
                {selected.length === 1 && (
                  <YAxis
                    yAxisId="spacer"
                    orientation="right"
                    width={64}
                    tick={false}
                    axisLine={false}
                    tickLine={false}
                  />
                )}
                {compare && (
                  <YAxis
                    yAxisId="spacer"
                    orientation="right"
                    width={64}
                    tick={false}
                    axisLine={false}
                    tickLine={false}
                  />
                )}
                {selected.map((metric) => (
                  <Line
                    key={metric.key}
                    type="linear"
                    yAxisId={compare ? 'compare' : metric.key}
                    dataKey={metric.key}
                    stroke={metric.color}
                    strokeDasharray={metric.dash}
                    strokeWidth={2}
                    connectNulls={false}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
                {sample && (
                  <ReferenceLine
                    x={sample.distance}
                    yAxisId={compare ? 'compare' : selected[0].key}
                    stroke="var(--ui-muted)"
                  />
                )}
                {sample &&
                  selected.map((metric) =>
                    sample[metric.key] == null ? null : (
                      <ReferenceDot
                        key={metric.key}
                        x={sample.distance}
                        y={Number(data[index!][metric.key])}
                        yAxisId={compare ? 'compare' : metric.key}
                        r={4}
                        fill={metric.color}
                        stroke="var(--ui-surface)"
                      />
                    ),
                  )}
              </LineChart>
            </ResponsiveContainer>
            {sample && (
              <div
                className="pointer-events-none absolute top-2 z-10 w-[min(250px,90%)] rounded-md border border-line bg-surface p-3 text-xs shadow-sm"
                style={{
                  left: `clamp(4px, calc(${distance ? (sample.distance / distance) * 100 : 0}% + ${64 - (distance ? sample.distance / distance : 0) * 128 + (sample.distance > distance / 2 ? -262 : 12)}px), calc(100% - 254px))`,
                }}
              >
                <strong className="mb-2 block border-b border-line pb-2 text-base tabular-nums">
                  {(sample.distance / 1000).toFixed(2)} km{' '}
                  {pinned && (
                    <span
                      role="img"
                      aria-label="Pinned"
                      title="Pinned"
                      className="ml-1 inline-flex align-middle text-primary"
                    >
                      <Pin size={14} aria-hidden="true" />
                    </span>
                  )}
                </strong>
                {selected.map((metric) => (
                  <div
                    key={metric.key}
                    className="flex justify-between gap-3 py-1"
                  >
                    <span>
                      <span style={{ color: metric.color }} aria-hidden="true">
                        ●{' '}
                      </span>
                      {metric.label}
                    </span>
                    <strong className="tabular-nums">
                      {valueLabel(sample[metric.key], metric)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-right text-xs text-muted">km</p>
          <details className="mt-2 text-xs text-muted">
            <summary
              aria-label="Chart help"
              title="Chart help"
              className="flex size-11 list-none items-center justify-center rounded-md [&::-webkit-details-marker]:hidden"
            >
              <CircleHelp size={18} aria-hidden="true" />
            </summary>
            <p className="max-w-xl pb-3">
              Hover or drag to inspect; click to pin. Keyboard: arrows to move,
              Enter to pin, Esc to clear. Gaps mean no data. Trends scale each
              metric to its own range; percentages aren’t measurements or
              fitness scores.
            </p>
          </details>
          <p className="sr-only" aria-live="polite">
            {sample &&
              `${(sample.distance / 1000).toFixed(2)} km. ${selected.map((m) => `${m.label}: ${valueLabel(sample[m.key], m)}`).join('. ')}`}
          </p>
        </>
      )}
    </section>
  );
}
