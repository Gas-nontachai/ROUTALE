import { useSimulationStore } from '../stores';
import { JourneyController } from './playback';

// Commands and rendered status share this bridge; the RAF scheduler stays in useJourney.
export function connectSimulation(
  engine: JourneyController,
  now = () => performance.now(),
) {
  const publish = () => {
    const frame = engine.frame;
    useSimulationStore.setState({
      status: engine.state,
      elapsed: engine.simulationTime,
      distance: frame.position.distance,
      waypoint:
        engine.journey.world.spots.filter(
          (spot) => spot.distance <= frame.position.distance,
        ).length - 1,
      movement: frame.position.movement,
      completion: frame.reveal,
      transitionProgress: engine.transitionProgress,
    });
  };
  publish();
  const unsubscribe = useSimulationStore.subscribe((state, previous) => {
    const time = now();
    if (state.resetToken !== previous.resetToken) {
      engine.reset();
      publish();
    } else if (state.seekToken !== previous.seekToken) {
      engine.seek(state.elapsed);
      publish();
    } else if (state.commandToken !== previous.commandToken) {
      if (state.command === 'begin') engine.begin(time);
      else if (state.command === 'pause') engine.pause(time, state.speed);
      else if (state.command === 'summary') engine.showSummary();
      publish();
    } else if (state.speed !== previous.speed) {
      engine.advance(time, previous.speed);
      publish();
    }
  });
  return { publish, unsubscribe };
}
