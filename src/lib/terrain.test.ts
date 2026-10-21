import { describe, expect, it, vi } from 'vitest';
import type { Map } from 'maplibre-gl';
import {
  configureTerrain,
  demSource,
  drawnTerrainElevation,
  terrainProfile,
} from './terrain';

function mapFixture() {
  const sources = new Set<string>(),
    layers = new Set<string>();
  const map = {
    getSource: (id: string) => sources.has(id),
    getLayer: (id: string) => layers.has(id),
    addSource: vi.fn((id: string) => sources.add(id)),
    removeSource: vi.fn((id: string) => sources.delete(id)),
    addLayer: vi.fn((layer: { id: string }) => layers.add(layer.id)),
    removeLayer: vi.fn((id: string) => layers.delete(id)),
    getStyle: () => ({
      layers: [
        { id: 'labels', type: 'symbol' },
        { id: 'route-outline', type: 'line' },
      ],
    }),
    setTerrain: vi.fn(),
    getTerrain: () => ({ source: 'terrain-dem' }),
    terrain: {
      getDrawnElevationForLngLat: vi.fn<() => number | undefined>(
        () => undefined,
      ),
    },
  };
  return { stub: map, map: map as unknown as Map };
}
describe('terrain setup and rendering evidence', () => {
  it('uses explicit Terrarium DEM and separate terrain/hillshade sources beneath labels and the route', () => {
    const { map, stub } = mapFixture();
    configureTerrain(map, true, terrainProfile.exaggeration, 12);
    expect(stub.addSource.mock.calls.map(([id]) => id)).toEqual([
      'terrain-dem',
      'hillshade-dem',
    ]);
    expect(demSource(12)).toMatchObject({
      type: 'raster-dem',
      encoding: 'terrarium',
      tileSize: 512,
      maxzoom: 12,
    });
    expect(stub.setTerrain).toHaveBeenLastCalledWith({
      source: 'terrain-dem',
      exaggeration: 1.5,
    });
    expect(stub.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'hillshade',
        paint: expect.objectContaining({
          'hillshade-exaggeration': 0.25,
          'hillshade-illumination-anchor': 'map',
        }),
      }),
      'labels',
    );
    configureTerrain(map, true, 2, 12);
    expect(stub.addSource).toHaveBeenCalledTimes(2);
    expect(stub.addLayer).toHaveBeenCalledTimes(1);
    expect(stub.setTerrain).toHaveBeenLastCalledWith({
      source: 'terrain-dem',
      exaggeration: 2,
    });
  });
  it('does not mistake enabled terrain or missing DEM for rendered terrain, including true zero elevation', () => {
    const { map, stub } = mapFixture();
    expect(drawnTerrainElevation(map, [98.9, 18.8])).toBeUndefined();
    stub.terrain.getDrawnElevationForLngLat.mockReturnValue(0);
    expect(drawnTerrainElevation(map, [98.9, 18.8])).toBe(0);
    stub.terrain.getDrawnElevationForLngLat.mockReturnValue(1250);
    expect(drawnTerrainElevation(map, [98.9, 18.8])).toBe(1250);
    stub.getTerrain = () => null as never;
    expect(drawnTerrainElevation(map, [98.9, 18.8])).toBeUndefined();
  });
  it('removes terrain and shade for 2D fallback and recreates sources on retry', () => {
    const { map, stub } = mapFixture();
    configureTerrain(map, true, 1.5, 10);
    configureTerrain(map, false, 1.5, 10);
    expect(stub.setTerrain).toHaveBeenLastCalledWith(null);
    expect(stub.removeLayer).toHaveBeenCalledWith('terrain-hillshade');
    expect(stub.removeSource.mock.calls.map(([id]) => id)).toEqual([
      'hillshade-dem',
      'terrain-dem',
    ]);
    configureTerrain(map, true, 1.5, 10);
    expect(stub.addSource).toHaveBeenCalledTimes(4);
  });
});
