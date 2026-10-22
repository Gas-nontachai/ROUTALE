import { describe, expect, it } from 'vitest';
import smartDemo from './fixtures/Smart_Route.gpx?raw';
import hike from './fixtures/Lunch_Hike.gpx?raw';
import alpine from './fixtures/alpine-terrain.gpx?raw';
import { buildJourney, evaluateJourney } from './journey';
import { createWorld, parseGpx } from './route';
import {
  angleDelta,
  completionPresentation,
  motionProfile,
  smoothstep,
  smootherstep,
} from './motion';

const world = createWorld(parseGpx(smartDemo));
const journey = buildJourney(world);
describe('single deterministic journey timeline', () => {
  it('crossfades the route and summary with a stationary, invisible framing handoff', () => {
    expect(completionPresentation(0)).toEqual({ summary: false, opacity: 1 });
    expect(completionPresentation(0.5)).toEqual({ summary: true, opacity: 0 });
    expect(completionPresentation(1)).toEqual({ summary: true, opacity: 1 });
    for (const progress of [0.001, 0.1, 0.25, 0.49]) {
      expect(completionPresentation(progress).opacity).toBeCloseTo(
        completionPresentation(1 - progress).opacity,
        10,
      );
    }
    // Quintic easing approaches the swap with zero velocity on both sides.
    expect(completionPresentation(0.499).opacity).toBeLessThan(0.000001);
    expect(completionPresentation(0.501).opacity).toBeLessThan(0.000001);
    const reduced = buildJourney(world, true);
    expect(
      completionPresentation(
        evaluateJourney(reduced, reduced.total).completionProgress,
      ),
    ).toEqual({ summary: true, opacity: 1 });
  });
  it('evaluates the same character, camera and reveal regardless of evaluation order', () => {
    const time = journey.intro + world.duration * 0.63;
    const expected = evaluateJourney(journey, time);
    evaluateJourney(journey, journey.total);
    evaluateJourney(journey, 0);
    expect(evaluateJourney(journey, time)).toEqual(expected);
    expect(buildJourney(world)).toEqual(journey);
  });
  it('keeps an oblique route-aware view through preview, turns, stops, replay and completion', () => {
    for (const fixture of [smartDemo, hike]) {
      const route = createWorld(parseGpx(fixture));
      const timeline = buildJourney(route);
      expect(timeline.overview.pitch).toBe(60);
      for (const camera of timeline.cameras) {
        expect(camera.pitch).toBe(60);
        expect(camera.mode).not.toBe('Top-down');
        expect(
          angleDelta(timeline.overview.bearing, camera.bearing),
        ).toBeCloseTo(0);
      }
      expect(evaluateJourney(timeline, 0).camera.pitch).toBe(60);
      expect(
        evaluateJourney(timeline, timeline.total).camera.pitch,
      ).toBeGreaterThanOrEqual(48);
      expect(evaluateJourney(buildJourney(route), 0)).toEqual(
        evaluateJourney(timeline, 0),
      );
      const reduced = buildJourney(route, true);
      expect(evaluateJourney(reduced, 5).camera.pitch).toBe(60);
    }
  });
  it('holds zoom throughout every rest instead of zooming out and back in', () => {
    const rests = world.steps.filter((step) => step.type === 'stay');
    expect(rests.length).toBeGreaterThan(0);
    for (const rest of rests) {
      const indices = journey.cameras.flatMap((_, i) =>
        i / motionProfile.sampleRate >= rest.start &&
        i / motionProfile.sampleRate < rest.end
          ? [i]
          : [],
      );
      for (const i of indices) {
        if (i)
          expect(journey.cameras[i].zoom).toBe(journey.cameras[i - 1].zoom);
      }
    }
  });
  it('uses real map relief independently of absent GPX elevations and preserves playback coordinates', () => {
    const route = createWorld(parseGpx(alpine));
    const timeline = buildJourney(route);
    expect(route.processed.stats.ascent).toBeUndefined();
    expect(route.processed.stats.minElevation).toBeUndefined();
    expect(timeline.overview.pitch).toBe(60);
    const finish = evaluateJourney(timeline, timeline.intro + route.duration);
    expect(finish.position.x).toBeCloseTo(route.segments.at(-1)!.at(-1)!.x);
    expect(finish.position.y).toBeCloseTo(route.segments.at(-1)!.at(-1)!.y);
    expect(finish.position.elevation).toBeUndefined();
    expect(finish.routeProgress).toBeCloseTo(1);
  });
  it('settles at the finish with a complementary crossfade and no finish spin', () => {
    const end = journey.intro + world.duration;
    const first = evaluateJourney(journey, end);
    const middle = evaluateJourney(journey, end + journey.completion / 2);
    const last = evaluateJourney(journey, journey.total);
    expect(first.phase).toBe('Completing');
    expect(middle.position).toEqual(first.position);
    expect(middle.reveal).toBeCloseTo(0.5);
    expect(last.camera.bearing).toBe(first.camera.bearing);
    expect(last.camera.center).toEqual(first.camera.center);
    expect(last.phase).toBe('Completed');
    expect(last.reveal).toBe(1);
    expect(last.routeProgress).toBeCloseTo(1);
    expect(evaluateJourney(journey, 0).reveal).toBe(0);
  });
  it('uses a static overview and immediate completion for reduced motion', () => {
    const reduced = buildJourney(world, true);
    expect(reduced.intro).toBe(0);
    expect(reduced.completion).toBe(0);
    expect(evaluateJourney(reduced, 5).camera.center).toEqual(
      evaluateJourney(reduced, 15).camera.center,
    );
    expect(evaluateJourney(reduced, reduced.total).reveal).toBe(1);
  });
  it('bounds baked camera velocity, acceleration, bearing, pitch, and zoom on hikes and repeated laps', () => {
    for (const fixture of [smartDemo, hike]) {
      const route = createWorld(parseGpx(fixture));
      const timeline = buildJourney(route);
      const dt = 1 / motionProfile.sampleRate;
      const maxSpeed = Math.max(300, (route.distance / route.duration) * 3);
      let previousVelocity = [0, 0],
        previousTurn = 0;
      const last = timeline.cameras.at(-1)!,
        beforeLast = timeline.cameras.at(-2)!;
      expect(
        Math.hypot(last.x - beforeLast.x, last.y - beforeLast.y),
      ).toBeLessThan(1e-6);
      expect(
        Math.abs(angleDelta(beforeLast.bearing, last.bearing)),
      ).toBeLessThan(1e-6);
      timeline.cameras.forEach((camera, i, frames) => {
        expect(camera.pitch).toBeGreaterThanOrEqual(motionProfile.minPitch);
        expect(camera.pitch).toBeLessThanOrEqual(motionProfile.maxPitch);
        expect(camera.zoom).toBeGreaterThanOrEqual(motionProfile.minZoom);
        expect(camera.zoom).toBeLessThanOrEqual(motionProfile.maxZoom);
        if (!i) return;
        const previous = frames[i - 1];
        const velocity = [
          (camera.x - previous.x) / route.projection.scale / dt,
          (camera.y - previous.y) / route.projection.scale / dt,
        ];
        const turn = angleDelta(previous.bearing, camera.bearing) / dt;
        expect(Math.hypot(...velocity)).toBeLessThanOrEqual(maxSpeed + 1e-6);
        expect(
          Math.hypot(
            velocity[0] - previousVelocity[0],
            velocity[1] - previousVelocity[1],
          ) / dt,
        ).toBeLessThanOrEqual(maxSpeed / 2 + 1e-5);
        expect(Math.abs(turn)).toBeLessThanOrEqual(
          motionProfile.angularSpeed + 1e-6,
        );
        expect(Math.abs(turn - previousTurn) / dt).toBeLessThanOrEqual(
          motionProfile.angularAcceleration + 1e-5,
        );
        expect(
          Math.abs(camera.pitch - previous.pitch) / dt,
        ).toBeLessThanOrEqual(motionProfile.pitchSpeed + 1e-5);
        expect(Math.abs(camera.zoom - previous.zoom) / dt).toBeLessThanOrEqual(
          motionProfile.zoomSpeed + 1e-5,
        );
        previousVelocity = velocity;
        previousTurn = turn;
      });
    }
  });
  it('prepares bounded durations with complexity and elevation, and keeps source references', () => {
    const straight = createWorld(
      parseGpx(
        '<gpx><rte><rtept lat="0" lon="0"/><rtept lat="0" lon="0.01"/></rte></gpx>',
      ),
    );
    const climbing = createWorld(
      parseGpx(
        '<gpx><rte><rtept lat="0" lon="0"><ele>0</ele></rtept><rtept lat="0" lon="0.01"><ele>400</ele></rtept></rte></gpx>',
      ),
    );
    expect(climbing.duration).toBeGreaterThan(straight.duration);
    expect(world.duration).toBeGreaterThanOrEqual(motionProfile.minPlayback);
    expect(world.duration).toBeLessThanOrEqual(motionProfile.maxPlayback);
    for (const segment of world.segments)
      for (const p of segment) {
        expect(p.sourceSegment).toBeDefined();
        expect(p.sourceIndex).toBeDefined();
      }
    expect(smootherstep(-1)).toBe(0);
    expect(smoothstep(2)).toBe(1);
  });
});
