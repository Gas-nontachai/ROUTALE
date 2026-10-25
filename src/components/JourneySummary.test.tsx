import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  JourneySummary,
  summaryMetrics,
  fastestCompleteSplit,
} from './JourneySummary';
import { ActivityAnalysis } from './ActivityAnalysis';
import { createWorld, parseGpx } from '../lib/route';
vi.mock('./SummaryMap', () => ({
  SummaryMap: () => <div data-testid="summary-map" />,
}));
const activity = parseGpx(
  '<gpx><trk><name>Test activity</name><trkseg><trkpt lat="0" lon="0"><ele>0</ele><time>2026-01-01T00:00:00Z</time></trkpt><trkpt lat="0" lon="0.001"><ele>10</ele><time>2026-01-01T00:01:00Z</time></trkpt></trkseg></trk></gpx>',
);
const world = createWorld(activity);
describe('responsive summary presentation', () => {
  it.each([
    ['Hiking', 'Moving pace'],
    ['Trail Running', 'Moving pace'],
    ['Running', 'Moving pace'],
    ['Walking', 'Moving pace'],
    ['Cycling', 'Moving speed'],
    ['', 'Elevation gain'],
  ])('uses %s primary metrics', (type, metric) => {
    expect(summaryMetrics(world, type).primary.map(([label]) => label)).toEqual(
      ['Distance', 'Moving time', metric],
    );
  });
  it('renders one shared map and Replay with partial splits and no invented sensors', () => {
    const html = renderToStaticMarkup(
      <JourneySummary world={world} activity={activity} onReplay={() => {}} />,
    );
    expect(html.match(/data-testid="summary-map"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Replay"');
    expect(html).toContain('(partial)');
    expect(html).not.toContain('Avg. HR');
    expect(html).not.toContain('NaN');
  });
  it('omits unavailable chart tabs and the entire chart when no series exist', () => {
    const html = renderToStaticMarkup(
      <ActivityAnalysis
        series={world.processed.chartSeries}
        distance={world.distance}
      />,
    );
    expect(html).toContain('Elevation');
    expect(html).not.toContain('Heart Rate');
    const empty: typeof world.processed.series = {
      elevation: [],
      pace: [],
      speed: [],
      heartRate: [],
      cadence: [],
      power: [],
      gradient: [],
      temperature: [],
    };
    expect(
      renderToStaticMarkup(<ActivityAnalysis series={empty} distance={100} />),
    ).toBe('');
  });
});

it('ranks complete kilometers only, excluding unavailable pace', () => {
  const split = {
    kilometer: 1,
    distance: 1000,
    partial: false,
    movingDistance: 1000,
  };
  const winner = { ...split, kilometer: 2, pace: 480 };
  expect(
    fastestCompleteSplit([
      { ...split, pace: 510 },
      { ...split, pace: NaN },
      { ...split, pace: 0 },
      { ...split, pace: -1 },
      winner,
      { ...split, kilometer: 3, partial: true, pace: 300 },
      split,
    ]),
  ).toBe(winner);
  expect(
    fastestCompleteSplit([{ ...split, partial: true, pace: 300 }, split]),
  ).toBeUndefined();
});

it('marks the fastest full kilometer with one accessible crown and no row hover or fill', () => {
  const base = {
    kilometer: 1,
    distance: 1000,
    partial: false,
    movingDistance: 1000,
  };
  const splitWorld = {
    ...world,
    processed: {
      ...world.processed,
      splits: [
        { ...base, pace: 540 },
        { ...base, kilometer: 2, pace: 480 },
        { ...base, kilometer: 3, distance: 400, partial: true, pace: 300 },
      ],
    },
  };
  const html = renderToStaticMarkup(
    <JourneySummary
      world={splitWorld}
      onReplay={() => {}}
      onImport={() => {}}
    />,
  );
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g)!;
  expect(rows[1]).not.toContain('lucide-crown');
  expect(rows[2]).toContain('aria-label="Fastest full kilometer"');
  expect(rows[2]).toContain('lucide-crown');
  expect(rows[3]).not.toContain('lucide-crown');
  expect(html.match(/class="lucide lucide-crown/g)).toHaveLength(1);
  expect(
    rows.every((row) => !row.includes('hover:') && !row.includes('bg-accent')),
  ).toBe(true);
  expect(html).toContain('aria-label="Import GPX"');
});
