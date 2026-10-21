import { useEffect, useMemo, useState } from 'react';
import { buildJourney } from '../lib/journey';
import { JourneyController } from '../lib/playback';
import { connectSimulation } from '../lib/simulation';
import { motionProfile } from '../lib/motion';
import type { World } from '../lib/route';
import { useSimulationStore } from '../stores';

export type JourneyEngine = JourneyController;
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
    const controller = new JourneyController(
      buildJourney(world, reducedMotion),
    );
    const state = useSimulationStore.getState();
    if (state.status === 'Completed') controller.showSummary();
    else if (state.status !== 'Ready') controller.seek(state.elapsed);
    return controller;
  }, [world, reducedMotion]);
  useEffect(() => {
    if (!engine || !active) return;
    const initial = useSimulationStore.getState();
    if (initial.status === 'Ready') engine.reset();
    let frameId = 0,
      lastPublish = -Infinity;
    const { publish, unsubscribe } = connectSimulation(engine);
    const tick = (now: number) => {
      if (['Playing', 'Transitioning', 'Completing'].includes(engine.state)) {
        engine.advance(now, useSimulationStore.getState().speed);
        if (
          now - lastPublish >= motionProfile.uiInterval * 1000 ||
          engine.state !== useSimulationStore.getState().status
        ) {
          publish();
          lastPublish = now;
        }
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frameId);
      unsubscribe();
      engine.pause(performance.now(), useSimulationStore.getState().speed);
    };
  }, [engine, active]);
  return engine;
}
