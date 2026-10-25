import { describe, expect, it } from 'vitest';
import {
  comparisonRows,
  metricRange,
  nearestRow,
  trendValue,
} from './chartComparison';
import type { ActivitySeries } from './analysis';
const empty: ActivitySeries = {
  elevation: [],
  pace: [],
  speed: [],
  heartRate: [],
  temperature: [],
  gradient: [],
  cadence: [],
  power: [],
};
describe('distance-aligned metric comparison', () => {
  it('aligns by recorded coordinates and source, not array index; keeps missing values and boundary gaps', () => {
    const series = {
      ...empty,
      elevation: [
        { distance: 0, sourceIndex: 0, value: 100 },
        { distance: 700, sourceIndex: 1, value: 120 },
        { distance: 700 },
        { distance: 700, sourceIndex: 2, value: 140 },
      ],
      pace: [
        { distance: 700, sourceIndex: 1, value: 480 },
        { distance: 700, sourceIndex: 2 },
      ],
    };
    const rows = comparisonRows(series, ['elevation', 'pace']);
    expect(rows.map((p) => p.distance)).toEqual([0, 700, 700, 700]);
    expect(rows[0].pace).toBeUndefined();
    expect(rows[1]).toMatchObject({ elevation: 120, pace: 480 });
    expect(rows[2].elevation).toBeNull();
    expect(rows[3]).toMatchObject({ elevation: 140, pace: null });
    expect(metricRange(rows, 'elevation')).toEqual([100, 140]);
  });
  it('normalizes flat and missing series without inventing real values or inverting pace', () => {
    expect(trendValue(180, [180, 180])).toBe(50);
    expect(trendValue(null, [0, 100])).toBeNull();
    expect(trendValue(undefined, [0, 100])).toBeNull();
    expect(trendValue(300, [300, 600])).toBe(0);
    expect(trendValue(600, [300, 600])).toBe(100);
    expect(metricRange([], 'pace')).toEqual([0, 0]);
  });
  it('chooses nearest real distance and preserves extrema after decimation', () => {
    const elevation = Array.from({ length: 6000 }, (_, i) => ({
      sourceIndex: i,
      distance: i * i,
      value: i === 3200 ? 9000 : i % 100,
    }));
    const rows = comparisonRows({ ...empty, elevation }, ['elevation']);
    expect(rows.length).toBeLessThan(elevation.length);
    expect(metricRange(rows, 'elevation')).toEqual([0, 9000]);
    expect(
      nearestRow(
        [
          { distance: 0, order: 0 },
          { distance: 900, order: 1 },
          { distance: 1000, order: 2 },
        ],
        800,
      ),
    ).toBe(1);
  });
});
