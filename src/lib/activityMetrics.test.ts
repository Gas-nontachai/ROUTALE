import { describe, expect, it } from 'vitest';
import {
  analyzeRoute,
  chartSamples,
  activityKind,
  timestamp,
} from './analysis';
import { parseGpx, type Activity, type GPSPoint } from './route';
import { paceLabel } from './format';
const start = Date.parse('2026-01-01T00:00:00Z');
const point = (x: number, seconds?: number, elevation?: number): GPSPoint => ({
  lat: 0,
  lon: x / 111195,
  time:
    seconds === undefined
      ? undefined
      : new Date(start + seconds * 1000).toISOString(),
  elevation,
});
const activity = (segments: GPSPoint[][], type = 'Running'): Activity => ({
  name: 'Test',
  count: segments.flat().length,
  segments,
  type,
  distance: 0,
  ascent: 0,
  seed: 1,
});
const analyze = (points: GPSPoint[]) => analyzeRoute(activity([points]));
const sensorGpx = (
  extension: string,
  declaration = 'xmlns:s="http://www.garmin.com/xmlschemas/TrackPointExtension/v2"',
  type = 'Cycling',
) =>
  parseGpx(
    `<gpx ${declaration}><metadata><desc>Recorded locally</desc></metadata><trk><type>${type}</type><trkseg><trkpt lat="0" lon="0"><extensions>${extension}</extensions></trkpt><trkpt lat="0" lon="0.001"/></trkseg></trk></gpx>`,
  );

describe('validated GPX sensors', () => {
  it('resolves arbitrary and local namespace prefixes, accepts negative device temperature', () => {
    const parsed = sensorGpx(
      '<s:TrackPointExtension><s:hr>145</s:hr><s:cad>82</s:cad><s:atemp>-5</s:atemp><s:speed>4</s:speed></s:TrackPointExtension>',
    );
    expect(parsed.segments[0][0]).toMatchObject({
      heartRate: 145,
      cadence: 82,
      cadenceType: 'cycling',
      temperature: -5,
      speed: 4,
    });
    expect(parsed.description).toBe('Recorded locally');
    expect(
      sensorGpx(
        '<s:TrackPointExtension xmlns:s="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"><s:hr>150</s:hr></s:TrackPointExtension>',
        '',
      ).segments[0][0].heartRate,
    ).toBe(150);
  });
  it('ignores unsupported namespaces, malformed values and unrelated sensor names', () => {
    for (const extension of [
      '<s:TrackPointExtension><s:hr>999</s:hr><s:cad>oops</s:cad></s:TrackPointExtension>',
      '<s:hr>140</s:hr>',
      '<other><power>300</power></other>',
    ])
      expect(sensorGpx(extension).segments[0][0].heartRate).toBeUndefined();
    expect(
      sensorGpx(
        '<s:TrackPointExtension><s:hr>145</s:hr></s:TrackPointExtension>',
        'xmlns:s="urn:unknown"',
      ).segments[0][0].heartRate,
    ).toBeUndefined();
  });
  it('preserves running cadence without pretending it is cycling rpm or full steps', () => {
    const parsed = sensorGpx(
      '<s:TrackPointExtension><s:cad>85</s:cad></s:TrackPointExtension>',
      undefined,
      'Running',
    );
    expect(parsed.segments[0][0]).toMatchObject({
      cadence: 85,
      cadenceType: 'running',
    });
    expect(analyzeRoute(parsed).stats.sensors.cadence?.max).toBeUndefined();
  });
  it('accepts known power schema only', () => {
    expect(
      sensorGpx(
        '<p:PowerInWatts>240</p:PowerInWatts>',
        'xmlns:p="http://www.garmin.com/xmlschemas/PowerExtension/v1"',
      ).segments[0][0].power,
    ).toBe(240);
  });
  it('preserves malformed timestamp strings while rejecting them for analysis', () => {
    const parsed = parseGpx(
      '<gpx><rte><rtept lat="0" lon="0"><time>yesterday</time></rtept><rtept lat="0" lon="0.001"/></rte></gpx>',
    );
    expect(parsed.segments[0][0].time).toBe('yesterday');
    expect(analyzeRoute(parsed).stats.movingTime).toBeUndefined();
    expect(timestamp('2026')).toBeNaN();
  });
});
describe('activity metrics', () => {
  it('uses moving distance with moving time and separates stop time', () => {
    const { stats, splits } = analyze([
      point(0, 0),
      point(500, 100),
      point(500, 200),
      point(1250, 350),
    ]);
    expect(stats.movingTime).toBe(250);
    expect(stats.averageMovingPace).toBeCloseTo(200, 2);
    expect(stats.elapsedPace).toBeCloseTo(280, 2);
    expect(splits).toHaveLength(2);
    expect(splits[0].pace).toBeCloseTo(200, 2);
    expect(splits[1].pace).toBeCloseTo(200, 2);
    expect(splits[1].distance).toBeCloseTo(250, 2);
    expect(splits[1].partial).toBe(true);
    expect(splits[0].partial).toBe(false);
  });
  it('keeps wall-clock segment gaps out of recorded and moving duration', () => {
    const { stats } = analyzeRoute(
      activity([
        [point(0, 0), point(100, 100)],
        [point(10000, 1000), point(10100, 1100)],
      ]),
    );
    expect(stats.distance).toBeCloseTo(200, 2);
    expect(stats.duration).toBe(200);
    expect(stats.elapsedTime).toBe(1100);
    expect(stats.movingTime).toBe(200);
  });
  it('does not report timing for missing, duplicate or reversed intervals', () => {
    for (const times of [
      [0, undefined, 100],
      [0, 0, 100],
      [100, 50, 200],
    ]) {
      const { stats, splits } = analyze(times.map((t, i) => point(i * 100, t)));
      expect(stats.averageMovingPace).toBeUndefined();
      expect(stats.elapsedTime).toBeUndefined();
      expect(splits[0].pace).toBeUndefined();
    }
    expect(
      analyze([point(0, 0), point(1000, 3600)]).stats.averageMovingPace,
    ).toBeUndefined();
  });
  it('keeps slow hiking movement and never divides by a stationary distance', () => {
    expect(
      analyze([point(0, 0), point(40, 100)]).stats.averageMovingPace,
    ).toBeCloseTo(2500, 1);
    expect(
      analyze([point(0, 0), point(0, 100)]).stats.averageMovingPace,
    ).toBeUndefined();
  });
  it('filters isolated elevation spikes and ignores small oscillations', () => {
    const points = [100, 101, 100, 500, 100, 101, 100].map((e, i) =>
      point(i * 20, i * 20, e),
    );
    const before = structuredClone(points);
    const { stats } = analyze(points);
    expect(stats.ascent).toBe(0);
    expect(stats.descent).toBe(0);
    expect(stats.maxElevation).toBe(101);
    expect(points).toEqual(before);
  });
  it('derives signed grades over 30 m without bridging elevation gaps', () => {
    const { series, stats } = analyze([
      point(0, 0, 0),
      point(40, 40, 4),
      point(80, 80, 8),
      point(120, 120),
      point(160, 160, 50),
      point(200, 200, 46),
    ]);
    expect(series.gradient[0].value).toBeUndefined();
    expect(series.gradient[1].value).toBeCloseTo(10, 2);
    expect(series.gradient[4].value).toBeUndefined();
    expect(series.gradient[5].value).toBeCloseTo(-10, 2);
    expect(stats.ascent).toBe(8);
    expect(stats.descent).toBe(4);
  });
  it('weights irregular sensor intervals and rejects tiny or long-gap coverage', () => {
    const points = [point(0, 0), point(10, 10), point(60, 60)].map((p, i) => ({
      ...p,
      heartRate: [100, 120, 160][i],
    }));
    expect(analyze(points).stats.sensors.heartRate?.average).toBeCloseTo(
      135,
      4,
    );
    expect(
      analyze(points.map((p, i) => (i ? { ...p, heartRate: undefined } : p)))
        .stats.sensors.heartRate?.average,
    ).toBeUndefined();
    expect(
      analyze([
        { ...point(0, 0), heartRate: 100 },
        { ...point(100, 120), heartRate: 150 },
      ]).stats.sensors.heartRate?.average,
    ).toBeUndefined();
  });
  it('preserves extrema and segment gaps in chart downsampling', () => {
    const samples = Array.from({ length: 20000 }, (_, i) => ({
      distance: i,
      value:
        i === 10001 ? undefined : i === 5001 ? 1000 : i === 6001 ? -1000 : 1,
    }));
    const display = chartSamples(samples);
    expect(display.length).toBeLessThan(1600);
    expect(display.some((p) => p.value === 1000)).toBe(true);
    expect(display.some((p) => p.value === -1000)).toBe(true);
    expect(display.some((p) => p.value === undefined)).toBe(true);
  });
  it('formats long pace values without losing minutes or emitting invalid numbers', () => {
    expect(paceLabel(5405)).toBe('90:05 /km');
    expect(paceLabel(359.8)).toBe('6:00 /km');
    expect(paceLabel(NaN)).toBe('Not available');
    expect(activityKind('Mountain Biking')).toBe('cycling');
  });
});

it('processes the 300,000-point limit with bounded chart output and no absent sensor arrays', () => {
  const points = Array.from({ length: 300000 }, (_, i) =>
    point(i, i, 100 + Math.sin(i / 100)),
  );
  const result = analyzeRoute(activity([points]));
  expect(result.segments[0]).toHaveLength(300000);
  expect(result.series.elevation).toHaveLength(300000);
  expect(result.chartSeries.elevation.length).toBeLessThanOrEqual(1600);
  expect(result.series.heartRate).toHaveLength(0);
  expect(result.stats.averageMovingPace).toBeCloseTo(1000, 1);
}, 30000);
