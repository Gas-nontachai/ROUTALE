import {
  LngLat,
  type Map,
  type RasterDEMSourceSpecification,
} from 'maplibre-gl';

export const terrainProfile = {
  exaggeration: 1.5,
  minExaggeration: 1,
  maxExaggeration: 2,
  loadTimeout: 20000,
};
export const demSource = (maxzoom: number): RasterDEMSourceSpecification => ({
  type: 'raster-dem',
  url: 'https://tiles.mapterhorn.com/tilejson.json',
  encoding: 'terrarium',
  tileSize: 512,
  maxzoom,
  attribution: '<a href="https://mapterhorn.com/attribution">© Mapterhorn</a>',
});

export function configureTerrain(
  map: Map,
  enabled: boolean,
  exaggeration: number,
  maxzoom: number,
) {
  if (!enabled) {
    map.setTerrain(null);
    if (map.getLayer('terrain-hillshade')) map.removeLayer('terrain-hillshade');
    for (const id of ['hillshade-dem', 'terrain-dem'])
      if (map.getSource(id)) map.removeSource(id);
    return;
  }
  if (!map.getSource('terrain-dem'))
    map.addSource('terrain-dem', demSource(maxzoom));
  // Separate sources avoid reducing terrain mesh quality when hillshade also consumes DEM tiles.
  if (!map.getSource('hillshade-dem'))
    map.addSource('hillshade-dem', demSource(maxzoom));
  if (!map.getLayer('terrain-hillshade')) {
    const before = map
      .getStyle()
      .layers.find(
        (layer) => layer.type === 'symbol' || layer.id === 'route-outline',
      )?.id;
    map.addLayer(
      {
        id: 'terrain-hillshade',
        type: 'hillshade',
        source: 'hillshade-dem',
        paint: {
          'hillshade-exaggeration': 0.25,
          'hillshade-shadow-color': '#657367',
          'hillshade-highlight-color': '#fff8e8',
          'hillshade-accent-color': '#7d8974',
          'hillshade-illumination-anchor': 'map',
          'hillshade-illumination-direction': 315,
        },
      },
      before,
    );
  }
  map.setTerrain({ source: 'terrain-dem', exaggeration });
}

// queryTerrainElevation alone may report zero before DEM arrives; drawn coverage distinguishes real sea level.
export function drawnTerrainElevation(
  map: Map,
  coordinates: [number, number],
): number | undefined {
  if (map.getTerrain()?.source !== 'terrain-dem') return undefined;
  return map.terrain?.getDrawnElevationForLngLat(new LngLat(...coordinates));
}
