import { describe, expect, it } from 'vitest';
import {
  buildHandoff,
  cameraDifference,
  camerasNear,
  clearanceZoom,
  evaluateHandoff,
  handoffDuration,
  handoffProfile,
  interpolateCamera,
  terrainEnvelope,
  type CameraPose,
} from './camera';
const pose: CameraPose = {
  center: [99, 18],
  zoom: 13,
  bearing: 359,
  pitch: 60,
  elevation: 300,
};
const known = terrainEnvelope(
  { enabled: true, height: 535, fov: 36.87, sample: () => 500 },
  [pose.center],
);
describe('adaptive camera handoff', () => {
  it('normalizes all four factors and limits wall-clock duration to three seconds', () => {
    const small = handoffDuration(pose, { ...pose, zoom: 13.1 });
    for (const target of [
      { ...pose, zoom: 10 },
      { ...pose, center: [100, 20] as [number, number] },
      { ...pose, bearing: 180 },
      { ...pose, pitch: 0 },
    ]) {
      expect(handoffDuration(pose, target)).toBeGreaterThan(small);
      expect(handoffDuration(pose, target)).toBeLessThanOrEqual(3);
    }
    expect(
      handoffDuration(pose, {
        ...pose,
        center: [-80, -60],
        zoom: 3,
        bearing: 179,
        pitch: 0,
      }),
    ).toBe(3);
    expect(handoffProfile.maxDuration).toBe(3);
  });
  it('resumes immediately within every near threshold and takes the short angular path', () => {
    expect(camerasNear(pose, { ...pose, bearing: -1 })).toBe(true);
    expect(handoffDuration(pose, { ...pose, bearing: 719 })).toBe(0);
    expect(camerasNear(pose, { ...pose, zoom: 13.04 })).toBe(false);
    expect(camerasNear(pose, { ...pose, center: [99.001, 18] })).toBe(false);
    const middle = interpolateCamera(pose, { ...pose, bearing: 1 }, 0.5);
    expect(middle.bearing).toBeCloseTo(360);
    const wrap = interpolateCamera(
      { ...pose, center: [179.9, 0] },
      { ...pose, center: [-179.9, 0] },
      0.5,
    );
    expect(Math.abs(wrap.center[0])).toBeCloseTo(180);
    expect(
      cameraDifference(
        { ...pose, center: [179.9, 0] },
        { ...pose, center: [-179.9, 0] },
      ).distance,
    ).toBeLessThan(23000);
  });
  it('chooses instant, smooth, flight and safe-flight strategies with exact continuous endpoints', () => {
    expect(buildHandoff(pose, pose, known).strategy).toBe('instant');
    expect(
      buildHandoff({ ...pose, zoom: 10 }, { ...pose, zoom: 10.2 }, known)
        .strategy,
    ).toBe('smooth');
    expect(
      buildHandoff(pose, { ...pose, center: [99.1, 18], bearing: 179 }, known)
        .strategy,
    ).toBe('flight');
    const extreme = buildHandoff(
      pose,
      { ...pose, zoom: 3, center: [-70, 45] },
      known,
    );
    expect(extreme.strategy).toBe('safe-flight');
    expect(evaluateHandoff(extreme, 0)).toEqual(extreme.from);
    expect(evaluateHandoff(extreme, 1)).toEqual(extreme.target);
    for (const boundary of [0.3, 0.7, 1]) {
      const before = evaluateHandoff(extreme, boundary - 1e-8),
        after = evaluateHandoff(extreme, boundary);
      expect(Math.abs(before.zoom - after.zoom)).toBeLessThan(1e-5);
      expect(cameraDifference(before, after).distance).toBeLessThan(1);
      expect(Math.abs(before.pitch - after.pitch)).toBeLessThan(1e-5);
    }
    const mid = evaluateHandoff(extreme, 0.5);
    expect(mid.pitch).toBe(0);
    expect(mid.zoom).toBeLessThanOrEqual(extreme.from.zoom);
  });
  it('returns directly from near and far zoom without retreating past either endpoint', () => {
    const missing = terrainEnvelope(
      { enabled: true, height: 535, fov: 36.87, sample: () => undefined },
      [pose.center],
    );
    for (const envelope of [known, missing, { ...known, enabled: false }]) {
      for (const zoom of [3, 10, 16]) {
        const from = {
          ...pose,
          center: [99.005, 18.002] as [number, number],
          zoom,
          bearing: 179,
          pitch: 30,
        };
        const handoff = buildHandoff(from, pose, envelope);
        expect(handoff.strategy).toBe('smooth');
        let previous = from.zoom;
        for (let i = 0; i <= 100; i++) {
          const camera = evaluateHandoff(handoff, i / 100);
          expect(camera.zoom).toBeGreaterThanOrEqual(Math.min(zoom, pose.zoom));
          expect(camera.zoom).toBeLessThanOrEqual(Math.max(zoom, pose.zoom));
          expect(
            (camera.zoom - previous) * Math.sign(pose.zoom - zoom),
          ).toBeGreaterThanOrEqual(0);
          expect(camera.pitch).toBeGreaterThanOrEqual(30);
          previous = camera.zoom;
        }
        expect(evaluateHandoff(handoff, 1)).toEqual(pose);
      }
    }
  });
  it('clears the terrestrial height bound while travelling in the overhead flight phase', () => {
    const flight = buildHandoff(
      pose,
      { ...pose, center: [105, 50], zoom: 10 },
      known,
    );
    for (const progress of [0.3, 0.4, 0.5, 0.6, 0.7]) {
      const camera = evaluateHandoff(flight, progress);
      const distancePixels = 535 / (2 * Math.tan((36.87 * Math.PI) / 360));
      const metersPerPixel =
        (40075016 * Math.cos((camera.center[1] * Math.PI) / 180)) /
        (512 * 2 ** camera.zoom);
      const altitude =
        camera.elevation +
        distancePixels *
          metersPerPixel *
          Math.cos((camera.pitch * Math.PI) / 180);
      expect(altitude).toBeGreaterThanOrEqual(
        handoffProfile.unknownTerrainCeiling + handoffProfile.clearance,
      );
    }
  });
  it('uses loaded zero-meter DEM, bounds clearance, and chooses conservative flights for missing DEM', () => {
    const sea = terrainEnvelope(
      { enabled: true, height: 535, fov: 36.87, sample: () => 0 },
      [pose.center],
    );
    expect(sea.unknown).toBe(false);
    const missing = terrainEnvelope(
      { enabled: true, height: 535, fov: 36.87, sample: () => undefined },
      [pose.center],
    );
    expect(missing.ceiling).toBe(0);
    expect(
      buildHandoff(pose, { ...pose, center: [100, 20], zoom: 10 }, missing)
        .strategy,
    ).toBe('safe-flight');
    expect(clearanceZoom(pose, missing)).toBe(clearanceZoom(pose, sea));
    expect(
      terrainEnvelope(
        { enabled: false, height: 535, fov: 36.87, sample: () => undefined },
        [pose.center],
      ).unknown,
    ).toBe(false);
  });
});
