import type { GPSPoint } from './route';

type Node = Record<string, any>;
const trackPoint =
  /^http:\/\/www\.garmin\.com\/xmlschemas\/TrackPointExtension\/v[12]$/;
const powerSchema = 'http://www.garmin.com/xmlschemas/PowerExtension/v1';

// Resolve namespace declarations at every level, including locally rebound prefixes.
export function normalizeGpx(
  node: any,
  inherited: Record<string, string> = {},
): any {
  if (Array.isArray(node))
    return node.map((item) => normalizeGpx(item, inherited));
  if (!node || typeof node !== 'object') return node;
  const scope = namespaces(node, inherited);
  const result: Node = {};
  for (const [key, value] of Object.entries(node)) {
    const local = key.split(':').at(-1)!;
    if (local === 'extensions') {
      const parsed = sensors(value, scope);
      result[local] = {
        sensors: parsed,
        unsupported: Object.keys(parsed).length === 0,
      };
    } else result[local] = normalizeGpx(value, scope);
  }
  return result;
}
function namespaces(node: Node, inherited: Record<string, string>) {
  const scope = { ...inherited };
  for (const [key, value] of Object.entries(node)) {
    if (key === '@_xmlns') scope[''] = String(value);
    else if (key.startsWith('@_xmlns:')) scope[key.slice(8)] = String(value);
  }
  return scope;
}
function sensors(
  node: any,
  inherited: Record<string, string>,
  parent = '',
  parentUri = '',
): Partial<GPSPoint> {
  const result: Partial<GPSPoint> = {};
  if (!node || typeof node !== 'object') return result;
  if (Array.isArray(node)) {
    for (const child of node)
      Object.assign(result, sensors(child, inherited, parent, parentUri));
    return result;
  }
  const scope = namespaces(node, inherited);
  for (const [key, raw] of Object.entries(node)) {
    if (key.startsWith('@_')) continue;
    const parts = key.split(':');
    const local = parts.at(-1)!;
    const localScope =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? namespaces(raw, scope)
        : scope;
    const uri = localScope[parts.length > 1 ? parts[0] : ''];
    const fields: Record<string, [keyof GPSPoint, number, number]> =
      trackPoint.test(uri ?? '') &&
      parent === 'TrackPointExtension' &&
      parentUri === uri
        ? {
            hr: ['heartRate', 1, 250],
            cad: ['cadence', 0, 254],
            atemp: ['temperature', -100, 100],
            ...(uri.endsWith('/v2')
              ? { speed: ['speed', 0, 100] as [keyof GPSPoint, number, number] }
              : {}),
          }
        : uri === powerSchema && parent === ''
          ? { PowerInWatts: ['power', 0, 5000] }
          : {};
    const field = fields[local];
    if (
      field &&
      (typeof raw === 'string' || typeof raw === 'number') &&
      String(raw).trim()
    ) {
      const value = Number(raw);
      if (
        Number.isFinite(value) &&
        value >= field[1] &&
        value <= field[2] &&
        (!['heartRate', 'cadence', 'power'].includes(field[0]) ||
          Number.isInteger(value))
      )
        Object.assign(result, { [field[0]]: value });
    }
    Object.assign(result, sensors(raw, scope, local, uri));
  }
  return result;
}
