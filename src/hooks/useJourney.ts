import { useEffect, useMemo, useState } from 'react';
import {
  buildJourney,
  evaluateJourney,
  JourneyClock,
  type Journey,
} from '../lib/journey';
import { motionProfile } from '../lib/motion';
import type { World } from '../lib/route';
import { useSimulationStore } from '../stores';

export type JourneyEngine = {
  journey: Journey;
  frame: ReturnType<typeof evaluateJourney>;
  subscribe: (
    render: (frame: ReturnType<typeof evaluateJourney>) => void,
  ) => () => void;
};
export function useJourney(world: World | null, active: boolean) {
  const [reducedMotion, setReducedMotion] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => {
      setReducedMotion(query.matches);
      useSimulationStore.getState().pause();
    };
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  const engine = useMemo(() => {
    if (!world) return null;
    const journey = buildJourney(world, reducedMotion);
    const listeners = new Set<
      (frame: ReturnType<typeof evaluateJourney>) => void
    >();
    const state = useSimulationStore.getState();
    const time =
      state.status === 'Ready'
        ? 0
        : state.status === 'Completed'
          ? journey.total
          : journey.intro + state.elapsed;
    return {
      journey,
      frame: evaluateJourney(journey, time),
      listeners,
      subscribe(render: (frame: ReturnType<typeof evaluateJourney>) => void) {
        listeners.add(render);
        render(this.frame);
        return () => {
          listeners.delete(render);
        };
      },
    };
  }, [world, reducedMotion]);
  useEffect(() => {
    if (!engine || !active) return;
    const clock = new JourneyClock(),
      { journey } = engine;
    const initial = useSimulationStore.getState();
    clock.seek(
      initial.status === 'Ready'
        ? 0
        : initial.status === 'Completed'
          ? journey.total
          : engine.frame.time,
    );
    let frameId = 0,
      lastPublish = -Infinity;
    const running = (status: string) =>
      ['Playing', 'Transitioning', 'Completing'].includes(status);
    const render = () => {
      const frame = evaluateJourney(journey, clock.time);
      engine.frame = frame;
      for (const listener of engine.listeners) listener(frame);
      return frame;
    };
    render();
    const publish = (
      frame: typeof engine.frame,
      status?: typeof frame.phase,
    ) => {
      useSimulationStore.setState({
        elapsed: frame.elapsed,
        distance: frame.position.distance,
        waypoint:
          journey.world.spots.filter(
            (spot) => spot.distance <= frame.position.distance,
          ).length - 1,
        movement: frame.position.movement,
        completion: frame.reveal,
        ...(status ? { status } : {}),
      });
    };
    const unsubscribe = useSimulationStore.subscribe((state, previous) => {
      if (state.resetToken !== previous.resetToken) clock.seek(0);
      else if (state.seekToken !== previous.seekToken)
        clock.seek(
          journey.intro + Math.min(journey.world.duration, state.elapsed),
        );
      else if (state.status === 'Completed' && previous.status !== 'Completed')
        clock.seek(journey.total);
      if (state.status !== previous.status || state.speed !== previous.speed) {
        clock.advance(
          performance.now(),
          running(previous.status),
          previous.speed,
          journey.total,
        );
        clock.advance(
          performance.now(),
          running(state.status),
          state.speed,
          journey.total,
        );
      }
      if (
        state.resetToken !== previous.resetToken ||
        state.seekToken !== previous.seekToken ||
        state.status !== previous.status
      )
        publish(render());
    });
    const tick = (now: number) => {
      const state = useSimulationStore.getState();
      clock.advance(now, running(state.status), state.speed, journey.total);
      if (running(state.status)) {
        const frame = render();
        if (
          now - lastPublish >= motionProfile.uiInterval * 1000 ||
          frame.phase !== state.status
        ) {
          publish(frame, frame.phase);
          lastPublish = now;
        }
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frameId);
      unsubscribe();
    };
  }, [engine, active]);
  return engine;
}
