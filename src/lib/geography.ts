import {
  projectGeo,
  unproject,
  type GPSPoint,
  type Point,
  type World,
} from './route';
export type MapFeature = {
  id: number;
  kind:
    'road' | 'trail' | 'forest' | 'grass' | 'water' | 'building' | 'landmark';
  points: Point[];
  name?: string;
  closed: boolean;
};
export type TerrainSample = Point & { elevation: number };
export type Geography = {
  features: MapFeature[];
  terrain: TerrainSample[];
  mapStatus: string;
  demStatus: string;
};
const cache = new Map<string, { expires: number; value: unknown }>();
async function request(url: string, init?: RequestInit): Promise<any> {
  const key = url + (init?.body || ''),
    prior = cache.get(key);
  if (prior && prior.expires > Date.now()) return prior.value;
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(25000),
    credentials: 'omit',
  });
  if (!response.ok) throw new Error(`Provider returned ${response.status}`);
  const value: unknown = await response.json();
  // Keep location data in this tab's memory only; provider-approved HTTP caching is left to the browser.
  if (cache.size >= 8) cache.delete(cache.keys().next().value!);
  cache.set(key, { expires: Date.now() + 5 * 60 * 1000, value });
  return value;
}
export function classifyMap(data: any, world: World): MapFeature[] {
  if (!Array.isArray(data?.elements)) throw new Error('Invalid map response');
  if (data.remark) throw new Error('Map query did not complete');
  const features: MapFeature[] = [];
  for (const element of data.elements.slice(0, 12000)) {
    const tags = element.tags || {};
    let kind: MapFeature['kind'] | undefined;
    if (tags.building && tags.building !== 'no') kind = 'building';
    else if (
      tags.natural === 'water' ||
      tags.waterway ||
      tags.landuse === 'reservoir'
    )
      kind = 'water';
    else if (tags.highway)
      kind = [
        'path',
        'footway',
        'steps',
        'bridleway',
        'track',
        'pedestrian',
      ].includes(tags.highway)
        ? 'trail'
        : 'road';
    else if (tags.landuse === 'forest' || tags.natural === 'wood')
      kind = 'forest';
    else if (
      ['grass', 'meadow', 'recreation_ground'].includes(tags.landuse) ||
      tags.natural === 'grassland' ||
      tags.leisure === 'park'
    )
      kind = 'grass';
    else if (
      tags.tourism ||
      tags.historic ||
      tags.natural === 'peak' ||
      tags.amenity === 'drinking_water' ||
      tags.amenity === 'shelter'
    )
      kind = 'landmark';
    if (!kind) continue;
    const coordinates: any[] = Array.isArray(element.geometry)
      ? element.geometry
      : [{ lat: element.lat, lon: element.lon }];
    const valid = coordinates.filter(
      (p) =>
        Number.isFinite(p?.lat) &&
        Number.isFinite(p?.lon) &&
        Math.abs(p.lat) <= 90 &&
        Math.abs(p.lon) <= 180,
    );
    if (valid.length !== coordinates.length || !valid.length) continue;
    const points = valid.map((p) => projectGeo(world, p));
    const closed =
      points.length > 2 &&
      valid[0].lat === valid[valid.length - 1].lat &&
      valid[0].lon === valid[valid.length - 1].lon;
    if (kind !== 'landmark' && points.length < 2) continue;
    features.push({
      id: element.id,
      kind,
      points,
      name: typeof tags.name === 'string' ? tags.name : undefined,
      closed,
    });
  }
  return features;
}
export async function loadGeography(
  world: World,
  onProgress: (message: string) => void,
): Promise<Geography> {
  const a = unproject(world, 0, world.height),
    b = unproject(world, world.width, 0);
  const latSpan = b.lat - a.lat,
    lonSpan = b.lon - a.lon;
  // shortcut: public APIs are bounded to local activity areas; tile larger/dateline areas when a dedicated provider is added.
  if (latSpan <= 0 || lonSpan <= 0 || latSpan > 0.18 || lonSpan > 0.18)
    return {
      features: [],
      terrain: [],
      mapStatus:
        'Local scenery: area too large or crosses the date line (limit ≈20 km).',
      demStatus:
        'DEM unavailable for this area; using GPX elevation where present.',
    };
  const bounds = [a.lat, a.lon, b.lat, b.lon]
    .map((n) => n.toFixed(5))
    .join(',');
  const query = `[out:json][timeout:20][maxsize:16777216];(way[highway](${bounds});way[building](${bounds});way[natural~"^(water|wood|grassland)$"](${bounds});way[landuse~"^(forest|grass|meadow|reservoir|recreation_ground)$"](${bounds});way[waterway](${bounds});way[leisure=park](${bounds});node[tourism](${bounds});node[historic](${bounds});node[natural=peak](${bounds});node[amenity~"^(drinking_water|shelter)$"](${bounds}););out geom;`;
  onProgress('Loading OpenStreetMap features and elevation grid…');
  const coordinates: (GPSPoint & { x: number; y: number })[] = [];
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const px = (world.width * x) / 7,
        py = (world.height * y) / 7;
      coordinates.push({ ...unproject(world, px, py), x: px, y: py });
    }
  const params = new URLSearchParams({
    latitude: coordinates.map((p) => p.lat.toFixed(5)).join(','),
    longitude: coordinates.map((p) => p.lon.toFixed(5)).join(','),
  });
  const [map, dem] = await Promise.allSettled([
    request('https://overpass.private.coffee/api/interpreter', {
      method: 'POST',
      body: new URLSearchParams({ data: query }),
    }).then((data) => classifyMap(data, world)),
    request(`https://api.open-meteo.com/v1/elevation?${params}`).then(
      (data) => {
        if (
          !Array.isArray(data?.elevation) ||
          data.elevation.length !== coordinates.length ||
          data.elevation.some(
            (n: unknown) =>
              typeof n !== 'number' ||
              !Number.isFinite(n) ||
              n < -500 ||
              n > 9000,
          )
        )
          throw new Error('Invalid DEM response');
        return coordinates.map((p, i) => ({
          x: p.x,
          y: p.y,
          distance: 0,
          elevation: data.elevation[i] as number,
        }));
      },
    ),
  ]);
  return {
    features: map.status === 'fulfilled' ? map.value : [],
    terrain: dem.status === 'fulfilled' ? dem.value : [],
    mapStatus:
      map.status === 'fulfilled'
        ? `${map.value.length} OpenStreetMap features loaded.`
        : 'Map provider unavailable. Showing procedural scenery, not real map features.',
    demStatus:
      dem.status === 'fulfilled'
        ? 'Open-Meteo DEM · 90 m source, sampled on an 8 × 8 grid.'
        : 'DEM unavailable. Using GPX-derived terrain where elevation exists; otherwise flat ground.',
  };
}
export function terrainHeight(
  world: World,
  geography: Geography | null,
  x: number,
  y: number,
): number | undefined {
  if (geography?.terrain.length === 64) {
    const gx = Math.max(0, Math.min(7, (x / world.width) * 7)),
      gy = Math.max(0, Math.min(7, (y / world.height) * 7));
    const ix = Math.min(6, Math.floor(gx)),
      iy = Math.min(6, Math.floor(gy)),
      tx = gx - ix,
      ty = gy - iy;
    const e = (dx: number, dy: number) =>
      geography.terrain[(iy + dy) * 8 + ix + dx].elevation;
    return (
      e(0, 0) * (1 - tx) * (1 - ty) +
      e(1, 0) * tx * (1 - ty) +
      e(0, 1) * (1 - tx) * ty +
      e(1, 1) * tx * ty
    );
  }
  let weight = 0,
    total = 0;
  for (const segment of world.segments) {
    const stride = Math.max(1, Math.floor(segment.length / 60));
    for (let i = 0; i < segment.length; i += stride) {
      const p = segment[i];
      if (p.elevation === undefined) continue;
      const w = 1 / Math.max(1, (x - p.x) ** 2 + (y - p.y) ** 2);
      total += w * p.elevation;
      weight += w;
    }
  }
  return weight ? total / weight : undefined;
}
export function heightConfig(world: World, geography: Geography | null) {
  const values = [
    ...(geography?.terrain.map((p) => p.elevation) || []),
    ...world.segments
      .flat()
      .flatMap((p) => (p.elevation === undefined ? [] : [p.elevation])),
  ];
  let min = Infinity,
    max = -Infinity;
  for (const value of values) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  // Normalize visual units only; source elevations and activity statistics remain in meters.
  return {
    min: Number.isFinite(min) ? min : 0,
    scale: Number.isFinite(max) ? Math.min(1, 130 / Math.max(1, max - min)) : 0,
  };
}
export function isometric(
  world: World,
  p: Point,
  elevation: number | undefined,
  config: { min: number; scale: number },
  exaggeration: number,
) {
  return {
    x: (p.x - p.y) * 0.75 + world.height * 0.75 + 120,
    y:
      (p.x + p.y) * 0.4 +
      400 -
      ((elevation ?? config.min) - config.min) * config.scale * exaggeration,
  };
}
