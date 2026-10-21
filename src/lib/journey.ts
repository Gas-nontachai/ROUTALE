import { animationAt, positionAt, unproject, type World } from './route';
import { bearing } from './map';
import {
  angleDelta,
  angleLerp,
  clamp,
  motionProfile as limits,
  smootherstep,
} from './motion';

export type CameraMode = 'Follow' | 'Wide' | 'Side' | 'Top-down' | 'Scenic';
export type CameraFrame = {
  x: number;
  y: number;
  bearing: number;
  pitch: number;
  zoom: number;
  mode: CameraMode;
};
export type Journey = {
  world: World;
  intro: number;
  completion: number;
  total: number;
  reducedMotion: boolean;
  cameras: CameraFrame[];
  headings: number[];
  overview: CameraFrame;
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mixCamera = (a: CameraFrame, b: CameraFrame, t: number): CameraFrame => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  bearing: angleLerp(a.bearing, b.bearing, t),
  pitch: lerp(a.pitch, b.pitch, t),
  zoom: lerp(a.zoom, b.zoom, t),
  mode: b.mode,
});

export function buildJourney(world: World, reducedMotion = false): Journey {
  const extent =
    Math.max(world.width - 400, world.height - 400) / world.projection.scale;
  const first = animationAt(world, 0);
  const relief =
    (world.processed.stats.maxElevation ?? 0) -
    (world.processed.stats.minElevation ?? 0);
  const highPoint = world.spots.find((spot) => spot.type === 'summit');
  const reference =
    relief > 100 &&
    highPoint &&
    Math.hypot(highPoint.x - first.x, highPoint.y - first.y) /
      world.projection.scale >
      100
      ? highPoint
      : positionAt(
          world,
          Math.min(world.distance, Math.max(100, world.distance * 0.25)),
        );
  const routeBearing =
    bearing(
      unproject(world, first.x, first.y),
      unproject(world, reference.x, reference.y),
    ) - 35;
  const overview: CameraFrame = {
    x: world.width / 2,
    y: world.height / 2,
    bearing: routeBearing,
    pitch: limits.obliquePitch,
    zoom: clamp(
      Math.log2(
        (40075016 * world.projection.cos) /
          Math.max(extent * 2, relief * 4, 100),
      ),
      limits.minZoom,
      15,
    ),
    mode: 'Wide',
  };
  const speedLimit = Math.max(
    limits.minCameraSpeed,
    (world.distance / world.duration) * limits.cameraSpeedMultiplier,
  );
  const acceleration = speedLimit / limits.accelerationTime;
  const target = {
    ...overview,
    x: first.x,
    y: first.y,
    pitch: limits.obliquePitch,
    zoom: Math.min(15, overview.zoom + (relief > 100 ? 1 : 1.5)),
    mode: 'Follow' as const,
  };
  const intro = 0;
  const cameras: CameraFrame[] = [];
  const headings: number[] = [];
  const dt = 1 / limits.sampleRate;
  let camera: CameraFrame = { ...target };
  let vx = 0,
    vy = 0,
    angularVelocity = 0;
  const count = Math.ceil(world.duration * limits.sampleRate);
  for (let i = 0; i <= count; i++) {
    const time = Math.min(world.duration, i * dt),
      p = animationAt(world, time);
    const before = animationAt(world, Math.max(0, time - 0.25));
    const after = animationAt(world, Math.min(world.duration, time + 0.25));
    headings.push(
      Math.hypot(after.x - before.x, after.y - before.y) < 0.001
        ? (headings.at(-1) ?? 0)
        : bearing(
            unproject(world, before.x, before.y),
            unproject(world, after.x, after.y),
          ),
    );
    // A stable view across the route reveals relief without chasing every GPS turn.
    const mode: CameraMode =
      p.movement === 'stay'
        ? 'Wide'
        : highPoint &&
            relief > 100 &&
            Math.abs(p.distance - highPoint.distance) <
              Math.max(100, world.distance * 0.04)
          ? 'Scenic'
          : 'Follow';
    const desired = {
      x: p.x,
      y: p.y,
      bearing: overview.bearing,
      pitch: limits.obliquePitch,
      zoom: clamp(
        mode === 'Wide'
          ? camera.zoom
          : overview.zoom + (mode === 'Scenic' ? 0.5 : 1.5),
        limits.minZoom,
        limits.maxZoom,
      ),
      mode,
    };
    if (i && !reducedMotion) {
      let dx = (desired.x - camera.x) / world.projection.scale,
        dy = (desired.y - camera.y) / world.projection.scale;
      const length = Math.hypot(dx, dy),
        factor = Math.min(1, speedLimit / (length || 1));
      const braking = world.duration - time <= speedLimit / acceleration;
      dx = (braking ? 0 : dx * factor) - vx;
      dy = (braking ? 0 : dy * factor) - vy;
      const velocityChange = Math.hypot(dx, dy),
        af = Math.min(1, (acceleration * dt) / (velocityChange || 1));
      vx += dx * af;
      vy += dy * af;
      const desiredAngularVelocity = clamp(
        world.duration - time <=
          limits.angularSpeed / limits.angularAcceleration
          ? 0
          : angleDelta(camera.bearing, desired.bearing),
        -Math.min(
          limits.angularSpeed,
          (limits.angularAcceleration * Math.max(0, world.duration - time)) / 2,
        ),
        Math.min(
          limits.angularSpeed,
          (limits.angularAcceleration * Math.max(0, world.duration - time)) / 2,
        ),
      );
      angularVelocity += clamp(
        desiredAngularVelocity - angularVelocity,
        -limits.angularAcceleration * dt,
        limits.angularAcceleration * dt,
      );
      camera = {
        x: camera.x + vx * dt * world.projection.scale,
        y: camera.y + vy * dt * world.projection.scale,
        bearing: camera.bearing + angularVelocity * dt,
        pitch: clamp(
          camera.pitch +
            clamp(
              desired.pitch - camera.pitch,
              -limits.pitchSpeed * dt,
              limits.pitchSpeed * dt,
            ),
          limits.minPitch,
          limits.maxPitch,
        ),
        zoom: clamp(
          camera.zoom +
            clamp(
              desired.zoom - camera.zoom,
              -limits.zoomSpeed * dt,
              limits.zoomSpeed * dt,
            ),
          limits.minZoom,
          limits.maxZoom,
        ),
        mode,
      };
    }
    cameras.push(reducedMotion ? overview : { ...camera });
  }
  const last = cameras.at(-1)!;
  const completion = reducedMotion
    ? 0
    : clamp(
        Math.max(
          limits.minCompletion,
          (1.875 * Math.min(12, last.pitch)) / limits.pitchSpeed,
          (1.875 * 0.4) / limits.zoomSpeed,
        ),
        limits.minCompletion,
        limits.maxCompletion,
      );
  return {
    world,
    intro,
    completion,
    total: intro + world.duration + completion,
    reducedMotion,
    cameras,
    headings,
    overview,
  };
}

export function evaluateJourney(journey: Journey, time: number) {
  const { world, intro, completion, cameras, overview } = journey;
  time = clamp(time, 0, journey.total);
  const elapsed = clamp(time - intro, 0, world.duration);
  const position = animationAt(world, elapsed);
  const sample = elapsed * limits.sampleRate,
    index = Math.min(Math.floor(sample), cameras.length - 1);
  let camera = mixCamera(
    cameras[index],
    cameras[Math.min(index + 1, cameras.length - 1)],
    sample - index,
  );
  const completionProgress =
    time >= intro + world.duration
      ? completion
        ? clamp((time - intro - world.duration) / completion)
        : 1
      : 0;
  const reveal = smootherstep(completionProgress);
  if (completionProgress)
    camera = {
      ...camera,
      pitch: camera.pitch - Math.min(12, camera.pitch) * reveal,
      zoom: Math.max(limits.minZoom, camera.zoom - 0.4 * reveal),
    };
  const direction = angleLerp(
    journey.headings[index],
    journey.headings[Math.min(index + 1, journey.headings.length - 1)],
    sample - index,
  );
  const geo = unproject(world, camera.x, camera.y);
  return {
    time,
    elapsed,
    position,
    direction,
    camera: { ...camera, center: [geo.lon, geo.lat] as [number, number] },
    routeProgress: clamp(position.distance / world.distance),
    completionProgress,
    reveal,
    phase:
      time >= journey.total
        ? ('Completed' as const)
        : time >= intro + world.duration
          ? ('Completing' as const)
          : time < intro
            ? ('Transitioning' as const)
            : ('Playing' as const),
  };
}
