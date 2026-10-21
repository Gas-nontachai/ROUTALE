import type { StyleSpecification } from 'maplibre-gl';

export const mapStyles = ['default', 'satellite', 'hybrid'] as const;
export type MapStyle = (typeof mapStyles)[number];
export const isMapStyle = (value: unknown): value is MapStyle =>
  mapStyles.some((style) => style === value);
export const satelliteSource = {
  type: 'raster',
  tiles: [
    'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg',
  ],
  tileSize: 256,
  maxzoom: 14,
  attribution:
    '<a href="https://maps.eox.at">EOX::Maps</a> · <a href="https://cloudless.eox.at">Sentinel-2 cloudless 2016 by EOX</a> (Contains modified Copernicus Sentinel data 2016) · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>',
} satisfies StyleSpecification['sources'][string];

export type BaseLayer = {
  id: string;
  type: string;
  visibility: 'visible' | 'none';
};

export function applyMapStyle(
  map: {
    setLayoutProperty: (
      id: string,
      name: 'visibility',
      value: 'visible' | 'none',
    ) => unknown;
  },
  style: MapStyle,
  layers: BaseLayer[],
) {
  for (const layer of layers)
    map.setLayoutProperty(
      layer.id,
      'visibility',
      style === 'default' ||
        (style === 'hybrid' &&
          (layer.type === 'line' || layer.type === 'symbol'))
        ? layer.visibility
        : 'none',
    );
  map.setLayoutProperty(
    'satellite-imagery',
    'visibility',
    style === 'default' ? 'none' : 'visible',
  );
}
