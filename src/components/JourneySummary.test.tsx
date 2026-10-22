import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { JourneySummary, summaryMetrics } from './JourneySummary';
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
    ['Hiking', 'Elevation gain'],
    ['Trail Running', 'Elevation gain'],
    ['Running', 'Avg. Moving Pace'],
    ['Walking', 'Avg. Moving Pace'],
    ['Cycling', 'Avg. Moving Speed'],
    ['', 'Elevation gain'],
  ])('uses %s primary metrics', (type, metric) => {
    expect(summaryMetrics(world, type).primary.map(([label]) => label)).toEqual(
      ['Total distance', 'Moving time', metric],
    );
  });
  it('renders one shared map and Replay with partial splits and no invented sensors', () => {
    const html = renderToStaticMarkup(
      <JourneySummary world={world} activity={activity} onReplay={() => {}} />,
    );
    expect(html.match(/data-testid="summary-map"/g)).toHaveLength(1);
    expect(html).toContain('Replay Adventure');
    expect(html).toContain('(partial)');
    expect(html).not.toContain('Avg. Heart Rate');
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
