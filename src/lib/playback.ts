import {
  buildHandoff,
  cameraOwner,
  evaluateHandoff,
  safeCamera,
  terrainEnvelope,
  type CameraEnvironment,
  type CameraHandoff,
  type CameraPose,
  type TerrainEnvelope,
} from './camera';
import { evaluateJourney, type Journey } from './journey';
import { clamp, motionProfile } from './motion';
import { unproject } from './route';

export type Playback =
  'Ready' | 'Transitioning' | 'Playing' | 'Paused' | 'Completing' | 'Completed';
export type CameraPort = {
  read: () => CameraPose;
  stop: () => void;
  environment: () => CameraEnvironment;
};
export type PlaybackFrame = Omit<
  ReturnType<typeof evaluateJourney>,
  'camera' | 'phase'
> & {
  camera: CameraPose;
  phase: Playback;
  owner: ReturnType<typeof cameraOwner>;
  transitionProgress: number;
};
export class JourneyController {
  state: Playback = 'Ready';
  simulationTime = 0;
  completionTime = 0;
  transitionProgress = 0;
  handoffFrom: 'initial' | 'resume' = 'initial';
  handoff: CameraHandoff | null = null;
  pausedFrom: 'Playing' | 'Completing' = 'Playing';
  private afterHandoff: 'Playing' | 'Completing' = 'Playing';
  pauseCamera: CameraPose | null = null;
  port: CameraPort | null = null;
  frame: PlaybackFrame;
  private lastNow: number | null = null;
  private handoffElapsed = 0;
  private camera: CameraPose;
  private safety: TerrainEnvelope | null = null;
  private grounds: number[] = [];
  private listeners = new Set<(frame: PlaybackFrame) => void>();
  constructor(public journey: Journey) {
    const view = journey.overview,
      geo = unproject(journey.world, view.x, view.y);
    this.camera = {
      center: [geo.lon, geo.lat],
      zoom: view.zoom,
      bearing: view.bearing,
      pitch: view.pitch,
      elevation: 0,
    };
    this.frame = this.evaluate();
  }
  subscribe = (render: (frame: PlaybackFrame) => void) => {
    this.listeners.add(render);
    render(this.frame);
    return () => {
      this.listeners.delete(render);
    };
  };
  connect(port: CameraPort) {
    this.port = port;
    return () => {
      if (this.port === port) {
        this.camera = port.read();
        this.port = null;
      }
    };
  }
  private prepareSafety(from: CameraPose) {
    const environment = this.port?.environment() ?? {
      enabled: false,
      sample: () => undefined,
      height: 320,
      fov: 36.87,
    };
    const centers: [number, number][] = [from.center];
    this.grounds = this.journey.cameras.map((camera, i) => {
      if (i % motionProfile.sampleRate && i !== this.journey.cameras.length - 1)
        return NaN;
      const geo = unproject(this.journey.world, camera.x, camera.y);
      const center: [number, number] = [geo.lon, geo.lat];
      centers.push(center);
      // Survey a corridor around the route as well as the center-to-center handoff path.
      for (const [dx, dy] of [
        [-0.001, 0],
        [0.001, 0],
        [0, -0.001],
        [0, 0.001],
      ])
        centers.push([center[0] + dx, clamp(center[1] + dy, -85, 85)]);
      const elevation = environment.enabled ? environment.sample(center) : 0;
      return elevation !== undefined && Number.isFinite(elevation)
        ? elevation
        : 0;
    });
    const target = evaluateJourney(this.journey, this.simulationTime).camera
      .center;
    for (let i = 1; i < 16; i++)
      centers.push([
        from.center[0] +
          ((((target[0] - from.center[0] + 540) % 360) - 180) * i) / 16,
        from.center[1] + ((target[1] - from.center[1]) * i) / 16,
      ]);
    this.safety = terrainEnvelope(environment, centers);
    for (let i = 0; i < this.grounds.length; i++) {
      if (Number.isFinite(this.grounds[i])) continue;
      const start =
        Math.floor(i / motionProfile.sampleRate) * motionProfile.sampleRate;
      const end = Math.min(
        start + motionProfile.sampleRate,
        this.grounds.length - 1,
      );
      this.grounds[i] =
        this.grounds[start] +
        ((this.grounds[end] - this.grounds[start]) * (i - start)) /
          (end - start || 1);
    }
  }
  private playbackCamera(
    frame: ReturnType<typeof evaluateJourney>,
  ): CameraPose {
    const sample = frame.elapsed * motionProfile.sampleRate,
      i = Math.min(Math.floor(sample), this.grounds.length - 1);
    const elevation = this.grounds.length
      ? this.grounds[i] +
        (this.grounds[Math.min(i + 1, this.grounds.length - 1)] -
          this.grounds[i]) *
          (sample - i)
      : 0;
    const pose = {
      center: frame.camera.center,
      zoom: frame.camera.zoom,
      bearing: frame.camera.bearing,
      pitch: frame.camera.pitch,
      elevation,
    };
    return this.safety ? safeCamera(pose, this.safety) : pose;
  }
  begin(now: number) {
    if (this.state !== 'Ready' && this.state !== 'Paused') return;
    const from = this.port?.read() ?? this.camera;
    this.port?.stop();
    this.afterHandoff = this.state === 'Paused' ? this.pausedFrom : 'Playing';
    this.handoffFrom = this.state === 'Ready' ? 'initial' : 'resume';
    if (!this.safety) this.prepareSafety(from);
    const target =
      this.handoffFrom === 'resume' && this.pauseCamera
        ? this.pauseCamera
        : this.playbackCamera(
            evaluateJourney(
              this.journey,
              this.simulationTime + this.completionTime,
            ),
          );
    this.handoff = buildHandoff(
      from,
      target,
      this.safety!,
      this.journey.reducedMotion,
    );
    this.handoffElapsed = 0;
    this.transitionProgress = this.handoff.duration ? 0 : 1;
    this.camera = from;
    this.state = this.handoff.duration ? 'Transitioning' : this.afterHandoff;
    if (!this.handoff.duration) this.camera = target;
    this.lastNow = now;
    this.publish();
  }
  pause(now: number, speed = 1) {
    if (!['Transitioning', 'Playing', 'Completing'].includes(this.state))
      return;
    this.advance(now, speed);
    if (this.state === 'Completed') return;
    this.camera = this.port?.read() ?? this.frame.camera;
    this.pauseCamera =
      this.state === 'Transitioning' && this.handoff
        ? this.handoff.target
        : this.camera;
    this.pausedFrom = this.state === 'Completing' ? 'Completing' : 'Playing';
    this.state = 'Paused';
    this.handoff = null;
    this.lastNow = null;
    this.port?.stop();
    this.publish();
  }
  reset() {
    this.camera = this.port?.read() ?? this.camera;
    this.port?.stop();
    this.state = 'Ready';
    this.simulationTime = 0;
    this.completionTime = 0;
    this.transitionProgress = 0;
    this.handoff = null;
    this.handoffElapsed = 0;
    this.lastNow = null;
    this.pauseCamera = null;
    this.safety = null;
    this.grounds = [];
    this.publish();
  }
  seek(time: number) {
    if (!Number.isFinite(time)) return;
    this.camera = this.port?.read() ?? this.camera;
    this.port?.stop();
    this.handoff = null;
    this.pauseCamera = null;
    this.simulationTime = clamp(time, 0, this.journey.world.duration);
    this.completionTime = 0;
    this.state = 'Paused';
    this.pausedFrom = 'Playing';
    this.lastNow = null;
    this.publish();
    // Seeking does not transfer camera ownership; Resume performs any required handoff.
  }
  showSummary() {
    this.handoff = null;
    this.port?.stop();
    this.simulationTime = this.journey.world.duration;
    this.completionTime = this.journey.completion;
    this.state = 'Completed';
    this.lastNow = null;
    this.publish();
  }
  advance(now: number, speed = 1) {
    const dt =
      this.lastNow === null ? 0 : Math.max(0, now - this.lastNow) / 1000;
    this.lastNow = now;
    if (this.state === 'Transitioning' && this.handoff) {
      this.handoffElapsed = Math.min(
        this.handoff.duration,
        this.handoffElapsed + dt,
      );
      if (this.handoff.duration - this.handoffElapsed < 1e-9)
        this.handoffElapsed = this.handoff.duration;
      this.transitionProgress = clamp(
        this.handoffElapsed / this.handoff.duration,
      );
      this.camera = evaluateHandoff(this.handoff, this.transitionProgress);
      if (this.transitionProgress === 1) this.state = this.afterHandoff;
    } else if (this.state === 'Playing') {
      this.simulationTime = Math.min(
        this.journey.world.duration,
        this.simulationTime + dt * speed,
      );
      if (this.simulationTime === this.journey.world.duration)
        this.state = this.journey.completion ? 'Completing' : 'Completed';
    } else if (this.state === 'Completing') {
      this.completionTime = Math.min(
        this.journey.completion,
        this.completionTime + dt,
      );
      if (this.completionTime === this.journey.completion)
        this.state = 'Completed';
    }
    return this.publish();
  }
  private evaluate(): PlaybackFrame {
    const base = evaluateJourney(
      this.journey,
      this.simulationTime + this.completionTime,
    );
    if (this.state === 'Playing' || this.state === 'Completing')
      this.camera = this.playbackCamera(base);
    return {
      ...base,
      camera: this.camera,
      phase: this.state,
      owner: cameraOwner(this.state),
      transitionProgress: this.transitionProgress,
    };
  }
  private publish() {
    this.frame = this.evaluate();
    for (const render of this.listeners) render(this.frame);
    return this.frame;
  }
}
