import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorld, parseGpx, projectGeo, unproject } from './route';
import {
  classifyMap,
  heightConfig,
  isometric,
  terrainHeight,
} from './geography';
const world = () =>
  createWorld(
    parseGpx(
      '<gpx><trk><trkseg><trkpt lat="18.8" lon="99"><ele>100</ele></trkpt><trkpt lat="18.81" lon="99.01"><ele>150</ele></trkpt></trkseg></trk></gpx>',
    ),
  );
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
describe('geographic data and terrain', () => {
  it('projects real coordinates into the route world and round-trips them', () => {
    const w = world(),
      point = { lat: 18.805, lon: 99.004 },
      projected = projectGeo(w, point),
      restored = unproject(w, projected.x, projected.y);
    expect(restored.lat).toBeCloseTo(point.lat, 7);
    expect(restored.lon).toBeCloseTo(point.lon, 7);
  });
  it('classifies OSM features and rejects invalid geometry or truncated responses', () => {
    const w = world();
    const features = classifyMap(
      {
        elements: [
          {
            id: 1,
            tags: { building: 'yes', name: 'A cottage' },
            geometry: [
              { lat: 18.8, lon: 99 },
              { lat: 18.8, lon: 99.001 },
              { lat: 18.801, lon: 99.001 },
              { lat: 18.8, lon: 99 },
            ],
          },
          {
            id: 2,
            tags: { natural: 'peak', name: 'Real named peak' },
            lat: 18.806,
            lon: 99.005,
          },
          {
            id: 3,
            tags: { highway: 'footway' },
            geometry: [
              { lat: 18.8, lon: 99 },
              { lat: 18.801, lon: 99.001 },
            ],
          },
          {
            id: 4,
            tags: { building: 'yes' },
            geometry: [{ lat: 'invalid', lon: 99 }],
          },
        ],
      },
      w,
    );
    expect(features.map((f) => f.kind)).toEqual([
      'building',
      'landmark',
      'trail',
    ]);
    expect(features[0].closed).toBe(true);
    expect(() =>
      classifyMap({ elements: [], remark: 'query timed out' }, w),
    ).toThrow();
  });
  it('interpolates a DEM grid and keeps vertical exaggeration separate from source meters', () => {
    const w = world(),
      geography = {
        features: [],
        mapStatus: '',
        demStatus: '',
        terrain: Array.from({ length: 64 }, (_, i) => ({
          x: ((i % 8) / 7) * w.width,
          y: (Math.floor(i / 8) / 7) * w.height,
          distance: 0,
          elevation: 100 + (i % 8) * 10,
        })),
      };
    expect(terrainHeight(w, geography, w.width / 2, w.height / 2)).toBeCloseTo(
      135,
    );
    const point = projectGeo(w, { lat: 18.8, lon: 99 });
    const config = heightConfig(w, geography);
    const flat = isometric(w, point, 150, config, 0),
      raised = isometric(w, point, 150, config, 2);
    expect(raised.x).toBe(flat.x);
    expect(raised.y).toBeLessThan(flat.y);
    expect(w.processed.stats.maxElevation).toBe(150);
  });
  it('loads bounded map and DEM requests, validates them, and reuses session cache', async () => {
    const fetch = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes('overpass')
          ? { elements: [] }
          : { elevation: Array(64).fill(125) },
    }));
    vi.stubGlobal('fetch', fetch);
    const { loadGeography } = await import('./geography');
    const result = await loadGeography(world(), () => {});
    expect(result.terrain).toHaveLength(64);
    expect(result.demStatus).toContain('90 m');
    await loadGeography(world(), () => {});
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][1].body.get('data')).toContain(
      '[maxsize:16777216]',
    );
    expect(
      new URL(fetch.mock.calls[1][0]).searchParams.get('latitude')?.split(','),
    ).toHaveLength(64);
  });
  it('falls back independently when providers fail or return malformed elevation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('overpass')) throw new TypeError('Network error');
        return { ok: true, json: async () => ({ elevation: ['not meters'] }) };
      }),
    );
    const { loadGeography } = await import('./geography');
    const result = await loadGeography(world(), () => {});
    expect(result.features).toHaveLength(0);
    expect(result.terrain).toHaveLength(0);
    expect(result.mapStatus).toContain('unavailable');
    expect(result.demStatus).toContain('unavailable');
    expect(terrainHeight(world(), result, 300, 400)).toBeGreaterThanOrEqual(
      100,
    );
  });
  it('never sends unbounded areas to public providers', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { loadGeography } = await import('./geography');
    const large = createWorld(
      parseGpx(
        '<gpx><rte><rtept lat="10" lon="10"/><rtept lat="11" lon="11"/></rte></gpx>',
      ),
    );
    const result = await loadGeography(large, () => {});
    expect(fetch).not.toHaveBeenCalled();
    expect(result.mapStatus).toContain('too large');
  });
});
