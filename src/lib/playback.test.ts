import { afterEach, describe, expect, it } from 'vitest';
import sample from './fixtures/Smart_Route.gpx?raw';
import { JourneyController } from './playback';
import { buildJourney, evaluateJourney } from './journey';
import { createWorld, parseGpx } from './route';
import { useSimulationStore as store } from '../stores';
import { connectSimulation } from './simulation';
import type { CameraPose } from './camera';

const world = createWorld(parseGpx(sample));
const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  store.getState().restart();
  store.getState().setSpeed(1);
});
function session(
  terrain = false,
  sample: () => number | undefined = () => undefined,
) {
  store.getState().restart();
  const engine = new JourneyController(buildJourney(world));
  let camera: CameraPose = {
    ...engine.frame.camera,
    center: [110, 30],
    zoom: 16,
    bearing: 180,
    pitch: 55,
  };
  let now = 0,
    stops = 0;
  const disconnect = engine.connect({
    read: () => structuredClone(camera),
    stop: () => {
      stops++;
    },
    environment: () => ({
      enabled: terrain,
      height: 535,
      fov: 36.87,
      sample: () => (terrain ? sample() : 0),
    }),
  });
  const unrender = engine.subscribe((frame) => {
    if (frame.owner === 'timeline') camera = structuredClone(frame.camera);
  });
  const bridge = connectSimulation(engine, () => now);
  cleanups.push(bridge.unsubscribe, unrender, disconnect);
  return {
    engine,
    camera: () => camera,
    explore: (pose: CameraPose) => {
      camera = structuredClone(pose);
    },
    tick: (time: number) => {
      now = time;
      engine.advance(now, store.getState().speed);
      bridge.publish();
    },
    stops: () => stops,
  };
}
describe('store / timeline / camera ownership integration', () => {
  it('freezes GPX during initial handoff, caps it at 3 real seconds at 8×, and only then starts playback', () => {
    const s = session();
    store.getState().setSpeed(8);
    store.getState().begin();
    expect(s.engine.handoffFrom).toBe('initial');
    expect(store.getState().status).toBe('Transitioning');
    const duration = s.engine.handoff!.duration * 1000;
    expect(duration).toBeLessThanOrEqual(3000);
    for (const t of [duration * 0.25, duration * 0.5, duration * 0.9]) {
      s.tick(t);
      expect(store.getState().elapsed).toBe(0);
      expect(s.engine.frame.position.distance).toBe(0);
    }
    s.tick(duration);
    expect(s.engine.state).toBe('Playing');
    expect(s.engine.simulationTime).toBe(0);
    s.tick(duration + 100);
    expect(s.engine.simulationTime).toBeCloseTo(0.8);
    expect(s.engine.frame.owner).toBe('timeline');
  });
  it('pauses before free exploration, resumes from the latest progress, and skips an unchanged camera handoff', () => {
    const s = session();
    store.getState().begin();
    s.tick(3000);
    s.tick(7000);
    store.getState().pause();
    const pausedTime = s.engine.simulationTime,
      position = s.engine.frame.position;
    expect(s.engine.frame.owner).toBe('user');
    s.tick(20000);
    expect(s.engine.simulationTime).toBe(pausedTime);
    store.getState().begin();
    expect(s.engine.state).toBe('Playing');
    expect(s.engine.handoff?.strategy).toBe('instant');
    store.getState().pause();
    s.explore({
      ...s.camera(),
      center: [-70, 40],
      zoom: 3,
      bearing: s.camera().bearing + 180,
    });
    store.getState().begin();
    expect(s.engine.handoffFrom).toBe('resume');
    expect(s.engine.state).toBe('Transitioning');
    s.tick(21500);
    expect(s.engine.simulationTime).toBe(pausedTime);
    expect(s.engine.frame.position).toEqual(position);
    s.tick(23000);
    expect(s.engine.state).toBe('Playing');
    expect(s.engine.simulationTime).toBe(pausedTime);
    s.tick(24000);
    expect(s.engine.simulationTime).toBeCloseTo(pausedTime + 1);
  });
  it('hands off directly from close and distant zoom on both Play and Resume without GPX drift', () => {
    for (const terrain of [false, true]) {
      for (const resume of [false, true]) {
        for (const zoom of [3, 16]) {
          const s = session(terrain, () => undefined);
          if (resume) {
            store.getState().begin();
            s.tick(3000);
            s.tick(5000);
            store.getState().pause();
          }
          const target = structuredClone(
            s.engine.pauseCamera ?? {
              ...evaluateJourney(s.engine.journey, 0).camera,
              elevation: 0,
            },
          );
          s.explore({
            ...target,
            center: [target.center[0] + 0.005, target.center[1] + 0.002],
            zoom,
          });
          const progress = s.engine.simulationTime;
          store.getState().begin();
          expect(s.engine.handoff?.strategy).toBe('smooth');
          expect(s.engine.handoff!.target.zoom).toBeGreaterThan(10);
          expect(s.engine.handoffFrom).toBe(resume ? 'resume' : 'initial');
          const handoff = s.engine.handoff!;
          const start = resume ? 5000 : 0;
          for (let i = 1; i <= 10; i++) {
            s.tick(start + (handoff.duration * 1000 * i) / 10);
            expect(s.engine.simulationTime).toBe(progress);
            expect(s.camera().zoom).toBeGreaterThanOrEqual(
              Math.min(zoom, handoff.target.zoom),
            );
            expect(s.camera().zoom).toBeLessThanOrEqual(
              Math.max(zoom, handoff.target.zoom),
            );
          }
          expect(s.engine.state).toBe('Playing');
          cleanups.splice(0).forEach((cleanup) => cleanup());
        }
      }
    }
  });
  it('uses the paused snapshot for immediate Resume even if DEM loading changes in the background', () => {
    let height = 300;
    const s = session(true, () => height);
    store.getState().begin();
    s.tick(3000);
    s.tick(5000);
    store.getState().pause();
    const paused = structuredClone(s.engine.pauseCamera);
    height = 900;
    store.getState().begin();
    expect(s.engine.state).toBe('Playing');
    expect(s.engine.handoff?.strategy).toBe('instant');
    expect(s.engine.handoff?.target).toEqual(paused);
  });
  it('rejoins the playback target after pausing a handoff rather than stranding the camera mid-flight', () => {
    const s = session();
    store.getState().begin();
    const target = structuredClone(s.engine.handoff!.target);
    s.tick(s.engine.handoff!.duration * 300);
    expect(s.engine.state).toBe('Transitioning');
    store.getState().pause();
    expect(s.engine.simulationTime).toBe(0);
    store.getState().begin();
    expect(s.engine.handoff?.target).toEqual(target);
    expect(s.engine.handoffFrom).toBe('resume');
    expect(s.engine.simulationTime).toBe(0);
  });
  it('can explore and hand back during completion without advancing GPX or losing the crossfade position', () => {
    const s = session();
    store.getState().seek(world.duration);
    store.getState().begin();
    s.tick(3000);
    s.tick(3100);
    s.tick(3500);
    store.getState().pause();
    const reveal = s.engine.frame.reveal;
    expect(s.engine.state).toBe('Paused');
    expect(reveal).toBeGreaterThan(0);
    s.explore({ ...s.camera(), center: [105, 25], zoom: 4 });
    store.getState().begin();
    expect(s.engine.state).toBe('Transitioning');
    s.tick(6500);
    expect(s.engine.state).toBe('Completing');
    expect(s.engine.frame.reveal).toBe(reveal);
    expect(s.engine.simulationTime).toBe(world.duration);
    s.tick(9500);
    expect(s.engine.state).toBe('Completed');
  });
  it('preserves the current camera and cancels old handoffs on reset from every state', () => {
    for (const state of [
      'Ready',
      'Transitioning',
      'Playing',
      'Paused',
      'Completing',
      'Completed',
    ] as const) {
      const s = session();
      if (state !== 'Ready') store.getState().begin();
      if (['Playing', 'Paused', 'Completing', 'Completed'].includes(state))
        s.tick(3000);
      if (state === 'Paused') store.getState().pause();
      if (state === 'Completing') {
        store.getState().seek(world.duration);
        store.getState().begin();
        s.tick(6000);
        s.tick(6100);
      }
      if (state === 'Completed') store.getState().showSummary();
      expect(s.engine.state).toBe(state);
      const before = structuredClone(s.camera());
      store.getState().restart();
      expect(s.engine.frame.camera).toEqual(before);
      expect(s.camera()).toEqual(before);
      expect(s.engine.state).toBe('Ready');
      expect(s.engine.frame.owner).toBe('user');
      expect(s.engine.simulationTime).toBe(0);
      s.tick(100000);
      expect(s.camera()).toEqual(before);
      expect(s.engine.state).toBe('Ready');
      expect(s.engine.handoff).toBeNull();
      cleanups.splice(0).forEach((cleanup) => cleanup());
    }
  });
  it('rejects repeated Play and survives repeated Pause / Resume / Reset without stale camera ownership', () => {
    const s = session();
    for (let i = 0; i < 20; i++) {
      store.getState().begin();
      const handoff = s.engine.handoff;
      store.getState().begin();
      expect(s.engine.handoff).toBe(handoff);
      s.tick(i * 1000 + 500);
      store.getState().pause();
      expect(s.engine.state).toBe('Paused');
      store.getState().restart();
      expect(s.engine.frame.owner).toBe('user');
    }
    expect(s.stops()).toBeGreaterThan(20);
  });
  it('keeps completion and summary on the same scheduler without advancing GPX past the finish', () => {
    const s = session();
    s.engine.seek(world.duration - 0.1);
    store.getState().begin();
    s.tick(3000);
    s.tick(3200);
    expect(s.engine.state).toBe('Completing');
    expect(s.engine.simulationTime).toBe(world.duration);
    const progress = s.engine.simulationTime;
    s.tick(4000);
    expect(s.engine.simulationTime).toBe(progress);
    expect(s.engine.frame.reveal).toBeGreaterThan(0);
    s.tick(7000);
    expect(s.engine.state).toBe('Completed');
    expect(s.engine.frame.reveal).toBe(1);
  });
  it('treats invalid DEM samples as unavailable instead of sending NaN to the map', () => {
    const s = session(true, () => NaN);
    store.getState().begin();
    s.tick(3000);
    expect(s.engine.handoff?.strategy).toBe('safe-flight');
    expect(Number.isFinite(s.engine.frame.camera.elevation)).toBe(true);
    expect(Number.isFinite(s.engine.frame.camera.zoom)).toBe(true);
  });
  it('uses a safe wide handoff when DEM is missing and remains independent of a renderer', () => {
    const s = session(true);
    store.getState().begin();
    expect(s.engine.handoff?.strategy).toBe('safe-flight');
    expect(s.engine.handoff!.duration).toBeLessThanOrEqual(3);
    s.tick(3000);
    expect(s.engine.state).toBe('Playing');
    store.getState().showSummary();
    expect(s.engine.frame.reveal).toBe(1);
    const headless = new JourneyController(buildJourney(world));
    headless.begin(0);
    headless.advance(3000);
    expect(headless.state).toBe('Playing');
  });
});
