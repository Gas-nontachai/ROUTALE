import { afterEach, expect, it, vi } from 'vitest';
import fixture from '../../public/Lunch_Hike.gpx?raw';
afterEach(() => vi.unstubAllGlobals());
it('processes a real fixture in the worker protocol and reports invalid XML safely', async () => {
  const worker = {
    postMessage: vi.fn(),
    onmessage: (_: MessageEvent<{ xml: string; filename: string }>) => {},
  };
  vi.stubGlobal('self', worker);
  await import('./gpx.worker');
  worker.onmessage({
    data: { xml: fixture, filename: 'Lunch_Hike.gpx' },
  } as MessageEvent);
  const result = worker.postMessage.mock.calls.at(-1)![0];
  expect(result.activity.count).toBeGreaterThan(0);
  expect(result.world.processed.stats.distance).toBeGreaterThan(0);
  expect(result.world.processed.chartSeries).toBeDefined();
  worker.onmessage({
    data: { xml: '<gpx>', filename: 'invalid.gpx' },
  } as MessageEvent);
  expect(worker.postMessage.mock.calls.at(-1)![0].error).toContain('valid GPX');
});
