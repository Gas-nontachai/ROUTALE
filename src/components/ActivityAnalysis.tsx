import { useId, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { paceLabel } from '../lib/format';
import { activityKind, type ActivitySeries } from '../lib/analysis';

const definitions: {
  key: keyof ActivitySeries;
  label: string;
  unit: string;
  color: string;
}[] = [
  { key: 'elevation', label: 'Elevation', unit: 'm', color: '#65874b' },
  { key: 'pace', label: 'Pace', unit: 'min/km', color: '#ba934d' },
  { key: 'speed', label: 'Speed', unit: 'km/h', color: '#427b73' },
  { key: 'heartRate', label: 'Heart Rate', unit: 'bpm', color: '#c45f54' },
  { key: 'cadence', label: 'Cadence', unit: 'rpm', color: '#8167a8' },
  { key: 'power', label: 'Power', unit: 'W', color: '#d08b3e' },
  {
    key: 'temperature',
    label: 'Device temperature',
    unit: '°C',
    color: '#ba934d',
  },
  { key: 'gradient', label: 'Gradient', unit: '%', color: '#54869c' },
];

export function ActivityAnalysis({
  series,
  distance,
  activityType,
}: {
  series: ActivitySeries;
  distance: number;
  activityType?: string;
}) {
  const available = definitions.filter(
    ({ key }) =>
      (activityType === undefined ||
        (key !== 'pace' && key !== 'speed') ||
        (key === 'speed'
          ? activityKind(activityType) === 'cycling'
          : ['running', 'trail-running', 'walking', 'hiking'].includes(
              activityKind(activityType),
            ))) &&
      series[key].some((p) => p.value !== undefined),
  );
  const id = useId();
  const [selected, setSelected] = useState<keyof ActivitySeries>('elevation');
  const metric =
    available.find((item) => item.key === selected) ?? available[0];
  if (!metric) return null;
  const data: { distance: number; value: number | null }[] = series[
    metric.key
  ].map((p) => ({
    ...p,
    value:
      p.value === undefined
        ? null
        : metric.key === 'pace'
          ? p.value / 60
          : p.value,
  }));
  return (
    <section
      className="rounded-2xl border border-[#D8E1D8] bg-white/70 p-4 sm:p-5"
      aria-label="Activity analysis"
    >
      <h2 className="text-lg font-bold text-[#19392C]">Activity analysis</h2>
      <div
        className="mt-3 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Analysis metric"
      >
        {available.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={`${id}-${item.key}`}
            aria-controls={`${id}-panel`}
            tabIndex={metric.key === item.key ? 0 : -1}
            aria-selected={metric.key === item.key}
            onKeyDown={(event) => {
              const index = available.indexOf(item);
              const next =
                event.key === 'ArrowRight'
                  ? (index + 1) % available.length
                  : event.key === 'ArrowLeft'
                    ? (index + available.length - 1) % available.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? available.length - 1
                        : undefined;
              if (next === undefined) return;
              event.preventDefault();
              setSelected(available[next].key);
              document.getElementById(`${id}-${available[next].key}`)?.focus();
            }}
            onClick={() => setSelected(item.key)}
            className={`min-h-11 rounded-full px-4 text-sm ${metric.key === item.key ? 'bg-[#19392C] text-white' : 'bg-[#edf1e9] text-[#385343]'}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        className="mt-4 h-56 w-full"
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${metric.key}`}
        aria-label={`${metric.label} by distance, in ${metric.unit}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            accessibilityLayer
            data={data}
            margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
          >
            <defs>
              <linearGradient id="activity-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={metric.color} stopOpacity={0.35} />
                <stop
                  offset="95%"
                  stopColor={metric.color}
                  stopOpacity={0.03}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#dce4da"
            />
            <XAxis
              type="number"
              dataKey="distance"
              domain={[0, distance]}
              tickFormatter={(v) => `${(v / 1000).toFixed(1)}`}
              tick={{ fontSize: 11, fill: '#65776C' }}
            />
            <YAxis
              unit={` ${metric.unit}`}
              width={65}
              tick={{ fontSize: 11, fill: '#65776C' }}
            />
            <Tooltip
              labelFormatter={(v) => `${(Number(v) / 1000).toFixed(2)} km`}
              formatter={(v) => [
                v == null
                  ? 'No data'
                  : metric.key === 'pace'
                    ? paceLabel(Number(v) * 60)
                    : `${Number(v).toFixed(1)} ${metric.unit}`,
                metric.label,
              ]}
            />
            <Area
              type="linear"
              dataKey="value"
              connectNulls={false}
              stroke={metric.color}
              strokeWidth={2}
              fill="url(#activity-area)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-[#65776C]">
        Hover or touch to inspect. Focus the chart and use arrow keys to explore
        recorded samples. Gaps indicate unavailable data.
      </p>
      <p className="text-center text-xs text-[#65776C]">Distance (km)</p>
    </section>
  );
}
