import { XMLParser, XMLValidator } from 'fast-xml-parser';
export type GPSPoint = { lat: number; lon: number; elevation?: number; time?: string };
export type Point = { x: number; y: number; distance: number };
export type Activity = { name: string; count: number; segments: GPSPoint[][]; distance: number; ascent: number; seed: number };
export type World = { width: number; height: number; segments: Point[][]; spots: (Point & { label: string })[]; distance: number; seed: number };
const list = <T,>(value: T | T[] | undefined): T[] => value === undefined ? [] : Array.isArray(value) ? value : [value];
const radians = (n: number) => n * Math.PI / 180;
export function meters(a: GPSPoint, b: GPSPoint) {
  const h = Math.sin(radians(b.lat - a.lat) / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(radians(b.lon - a.lon) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function parseGpx(xml: string, filename = 'Untitled adventure'): Activity {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('GPX files with document entities are not supported.');
  if (XMLValidator.validate(xml) !== true) throw new Error('This file is not valid GPX XML.');
  const root = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseAttributeValue: false }).parse(xml).gpx;
  if (!root) throw new Error('Choose a GPX file with a <gpx> root.');
  const tracks = list<any>(root.trk);
  const raw = tracks.flatMap(t => list<any>(t.trkseg).map(s => list<any>(s.trkpt)));
  if (!raw.length) raw.push(...list<any>(root.rte).map(r => list<any>(r.rtept)));
  const segments: GPSPoint[][] = [];
  let count = 0, distance = 0, ascent = 0;
  for (const segment of raw) {
    let valid: GPSPoint[] = [];
    const flush = () => { if (valid.length > 1) segments.push(valid); valid = []; };
    for (const p of segment) {
      const lat = Number(p['@_lat']), lon = Number(p['@_lon']);
      if (p['@_lat'] === undefined || p['@_lon'] === undefined || String(p['@_lat']).trim() === '' || String(p['@_lon']).trim() === '' || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) { flush(); continue; }
      const point: GPSPoint = { lat, lon };
      if (p.ele !== undefined && Number.isFinite(Number(p.ele))) point.elevation = Number(p.ele);
      if (typeof p.time === 'string' && Number.isFinite(Date.parse(p.time))) point.time = p.time;
      valid.push(point);
      if (++count > 300000) throw new Error('This track exceeds 300,000 points. Please split it into smaller GPX files.');
    }
    flush();
  }
  count = 0;
  for (const segment of segments) {
    count += segment.length;
    for (let i = 1; i < segment.length; i++) {
      distance += meters(segment[i - 1], segment[i]);
      if (segment[i].elevation !== undefined && segment[i - 1].elevation !== undefined) ascent += Math.max(0, segment[i].elevation! - segment[i - 1].elevation!);
    }
  }
  if (!segments.length || distance < 1) throw new Error('No walkable route found. Include at least two different, valid GPS coordinates.');
  let seed = 2166136261;
  for (let i = 0; i < xml.length; i++) seed = Math.imul(seed ^ xml.charCodeAt(i), 16777619);
  return { name: String(tracks[0]?.name || root.metadata?.name || list<any>(root.rte)[0]?.name || filename.replace(/\.gpx$/i, '')), count, segments, distance, ascent, seed: seed >>> 0 };
}
function simplify(points: Point[], tolerance = 1): Point[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length); keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    const a = points[start], b = points[end], dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
    let max = tolerance * tolerance, index = -1;
    for (let i = start + 1; i < end; i++) {
      const p = points[i], t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
      const d = (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2;
      if (d > max) { max = d; index = i; }
    }
    if (index >= 0) { keep[index] = 1; stack.push([start, index], [index, end]); }
  }
  return points.filter((_, i) => keep[i]);
}
export function createWorld(activity: Activity): World {
  const first = activity.segments[0][0];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, distance = 0;
  // shortcut: local projection suits activity-scale routes; use a global projection for transcontinental tracks.
  const cos = Math.max(0.001, Math.cos(radians(first.lat)));
  const projected = activity.segments.map(segment => {
    let longitude = first.lon;
    return segment.map((p, i) => {
      longitude += ((p.lon - longitude + 540) % 360) - 180;
      const x = radians(longitude - first.lon) * 6371000 * cos, y = -radians(p.lat - first.lat) * 6371000;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      if (i) distance += meters(segment[i - 1], p);
      return { x, y, distance };
    });
  });
  const scale = 1400 / Math.max(maxX - minX, maxY - minY, 1);
  const width = Math.max(1100, (maxX - minX) * scale + 400), height = Math.max(1000, (maxY - minY) * scale + 400);
  const segments = projected.map(s => simplify(s.map(p => ({ ...p, x: (p.x - (minX + maxX) / 2) * scale + width / 2, y: (p.y - (minY + maxY) / 2) * scale + height / 2 }))));
  const world: World = { width, height, segments, distance, seed: activity.seed, spots: [] };
  world.spots = Array.from({ length: 7 }, (_, i) => ({ ...positionAt(world, distance * i / 6), label: i === 0 ? 'Start' : i === 6 ? 'Finish' : `Waypoint ${i}` }));
  return world;
}
export function positionAt(world: World, distance: number): Point {
  const segment = world.segments.find(s => s[s.length - 1].distance > distance) ?? world.segments[world.segments.length - 1];
  if (distance <= segment[0].distance) return segment[0];
  let lo = 1, hi = segment.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (segment[mid].distance < distance) lo = mid + 1; else hi = mid; }
  const a = segment[lo - 1], b = segment[lo], t = Math.min(1, Math.max(0, (distance - a.distance) / (b.distance - a.distance || 1)));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, distance };
}
export function random(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
