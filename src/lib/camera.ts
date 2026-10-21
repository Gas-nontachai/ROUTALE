import {
  angleDelta,
  angleLerp,
  clamp,
  smoothstep,
  smootherstep,
  motionProfile,
} from './motion';
import { meters } from './route';

export type CameraPose = {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  elevation: number;
};
export type CameraEnvironment = {
  enabled: boolean;
  sample: (center: [number, number]) => number | undefined;
  height: number;
  fov: number;
};
export const handoffProfile = {
  minDuration: 0.25,
  maxDuration: 3,
  nearDistance: 3,
  nearZoom: 0.03,
  nearBearing: 1,
  nearPitch: 1,
  nearElevation: 3,
  distanceScale: 100000,
  zoomScale: 6,
  weights: { distance: 1.2, zoom: 0.75, bearing: 0.45, pitch: 0.35 },
  clearance: 300,
  // Mapterhorn terrestrial heights with the app's maximum 2× exaggeration remain below this ceiling.
  unknownTerrainCeiling: 20000,
};
const geo = (center: [number, number]) => ({ lon: center[0], lat: center[1] });
const mercatorY = (lat: number) =>
  Math.log(
    Math.tan(
      Math.PI / 4 + (clamp(lat, -85.0511287, 85.0511287) * Math.PI) / 360,
    ),
  );
export function interpolateCenter(
  a: [number, number],
  b: [number, number],
  t: number,
): [number, number] {
  return [
    a[0] + angleDelta(a[0], b[0]) * t,
    ((2 *
      Math.atan(
        Math.exp(mercatorY(a[1]) + (mercatorY(b[1]) - mercatorY(a[1])) * t),
      ) -
      Math.PI / 2) *
      180) /
      Math.PI,
  ];
}
export function interpolateCamera(
  a: CameraPose,
  b: CameraPose,
  t: number,
): CameraPose {
  return {
    center: interpolateCenter(a.center, b.center, smoothstep(t)),
    bearing: angleLerp(a.bearing, b.bearing, smoothstep(t)),
    zoom: a.zoom + (b.zoom - a.zoom) * smootherstep(t),
    pitch: a.pitch + (b.pitch - a.pitch) * smootherstep(t),
    elevation: a.elevation + (b.elevation - a.elevation) * smootherstep(t),
  };
}
export function cameraDifference(a: CameraPose, b: CameraPose) {
  return {
    distance: meters(geo(a.center), geo(b.center)),
    zoom: Math.abs(a.zoom - b.zoom),
    bearing: Math.abs(angleDelta(a.bearing, b.bearing)),
    pitch: Math.abs(a.pitch - b.pitch),
    elevation: Math.abs(a.elevation - b.elevation),
  };
}
export function camerasNear(a: CameraPose, b: CameraPose) {
  const d = cameraDifference(a, b),
    p = handoffProfile;
  return (
    d.distance <= p.nearDistance &&
    d.zoom <= p.nearZoom &&
    d.bearing <= p.nearBearing &&
    d.pitch <= p.nearPitch &&
    d.elevation <= p.nearElevation
  );
}
export function handoffDuration(a: CameraPose, b: CameraPose) {
  if (camerasNear(a, b)) return 0;
  const d = cameraDifference(a, b),
    p = handoffProfile;
  return clamp(
    p.minDuration +
      p.weights.distance *
        clamp(Math.log1p(d.distance) / Math.log1p(p.distanceScale)) +
      p.weights.zoom * clamp(d.zoom / p.zoomScale) +
      p.weights.bearing * clamp(d.bearing / 180) +
      p.weights.pitch * clamp(d.pitch / motionProfile.maxPitch),
    p.minDuration,
    p.maxDuration,
  );
}

export type TerrainEnvelope = {
  enabled: boolean;
  ceiling: number;
  unknown: boolean;
  height: number;
  fov: number;
};
export function terrainEnvelope(
  environment: CameraEnvironment,
  centers: [number, number][],
): TerrainEnvelope {
  let ceiling = 0,
    unknown = false;
  if (environment.enabled)
    for (const center of centers) {
      const height = environment.sample(center);
      if (height === undefined || !Number.isFinite(height)) unknown = true;
      else ceiling = Math.max(ceiling, height);
    }
  return {
    enabled: environment.enabled,
    ceiling,
    unknown,
    height: Math.max(1, environment.height),
    fov: environment.fov,
  };
}
// MapLibre's perspective distance, converted from screen pixels to ground meters.
export function clearanceZoom(pose: CameraPose, envelope: TerrainEnvelope) {
  const distancePixels =
    envelope.height / (2 * Math.tan((envelope.fov * Math.PI) / 360));
  const metersPerWorldPixel =
    (40075016 * Math.max(0.001, Math.cos((pose.center[1] * Math.PI) / 180))) /
    512;
  const heightNeeded = Math.max(
    handoffProfile.clearance,
    envelope.ceiling + handoffProfile.clearance - pose.elevation,
  );
  return clamp(
    Math.log2(
      (distancePixels *
        metersPerWorldPixel *
        Math.cos((pose.pitch * Math.PI) / 180)) /
        heightNeeded,
    ),
    motionProfile.minZoom,
    motionProfile.maxZoom,
  );
}
export function safeCamera(
  pose: CameraPose,
  envelope: TerrainEnvelope,
): CameraPose {
  return { ...pose, zoom: Math.min(pose.zoom, clearanceZoom(pose, envelope)) };
}
export type CameraHandoff = {
  from: CameraPose;
  target: CameraPose;
  duration: number;
  strategy: 'instant' | 'smooth' | 'flight' | 'safe-flight';
  cruiseZoom: number;
  envelope: TerrainEnvelope;
};
export function buildHandoff(
  from: CameraPose,
  target: CameraPose,
  envelope: TerrainEnvelope,
  reducedMotion = false,
): CameraHandoff {
  const d = cameraDifference(from, target);
  const duration = reducedMotion ? 0 : handoffDuration(from, target);
  // Wheel zoom shifts the focus too; local returns do not need an overhead flight.
  const local = d.distance < 5000;
  const strategy = !duration
    ? 'instant'
    : local
      ? 'smooth'
      : envelope.unknown || d.distance > 25000 || d.zoom > 4
        ? 'safe-flight'
        : 'flight';
  const middle = interpolateCamera(from, target, 0.5);
  // Fit the travel distance in a wide, overhead view before moving across terrain.
  const fitZoom = Math.log2(
    (40075016 * Math.max(0.001, Math.cos((middle.center[1] * Math.PI) / 180))) /
      Math.max(100, d.distance * 2),
  );
  const cruiseZoom = clamp(
    Math.min(
      from.zoom,
      target.zoom,
      fitZoom,
      clearanceZoom(
        {
          ...middle,
          center: [
            middle.center[0],
            Math.abs(from.center[1]) > Math.abs(target.center[1])
              ? from.center[1]
              : target.center[1],
          ],
          pitch: 0,
          elevation: Math.min(from.elevation, target.elevation),
        },
        {
          ...envelope,
          ceiling: envelope.enabled
            ? Math.max(envelope.ceiling, handoffProfile.unknownTerrainCeiling)
            : envelope.ceiling,
        },
      ),
    ),
    motionProfile.minZoom,
    motionProfile.maxZoom,
  );
  return { from, target, duration, strategy, cruiseZoom, envelope };
}
export function evaluateHandoff(
  handoff: CameraHandoff,
  progress: number,
): CameraPose {
  const t = clamp(progress),
    { from, target } = handoff;
  if (!t) return from;
  if (t === 1 || handoff.strategy === 'instant') return target;
  if (handoff.strategy === 'smooth') return interpolateCamera(from, target, t);
  const out = { ...from, zoom: handoff.cruiseZoom, pitch: 0 };
  const incoming = { ...target, zoom: handoff.cruiseZoom, pitch: 0 };
  if (t < 0.3) return interpolateCamera(from, out, t / 0.3);
  if (t < 0.7) return interpolateCamera(out, incoming, (t - 0.3) / 0.4);
  return interpolateCamera(incoming, target, (t - 0.7) / 0.3);
}
export const cameraOwner = (state: string) =>
  state === 'Ready' || state === 'Paused'
    ? 'user'
    : state === 'Completed'
      ? 'summary'
      : 'timeline';
