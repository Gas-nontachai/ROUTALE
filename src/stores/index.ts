import { create } from 'zustand';
import type { Activity, AnimationStep, World } from '../lib/route';
import type { ProcessedRoute } from '../lib/analysis';
import type { Geography } from '../lib/geography';
export const useGpxStore = create<{
  activity: Activity | null;
  originalFile: File | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string;
  set: (
    value: Partial<{
      activity: Activity | null;
      originalFile: File | null;
      status: 'idle' | 'loading' | 'ready' | 'error';
      error: string;
    }>,
  ) => void;
}>((set) => ({
  activity: null,
  originalFile: null,
  status: 'idle',
  error: '',
  set,
}));
export const useRouteStore = create<{
  processed: ProcessedRoute | null;
  setProcessed: (processed: ProcessedRoute) => void;
}>((set) => ({
  processed: null,
  setProcessed: (processed) => set({ processed }),
}));
export const useWorldStore = create<{
  world: World | null;
  geography: Geography | null;
  exaggeration: number;
  status: 'idle' | 'ready' | 'loading';
  stage: string;
  setWorld: (world: World) => void;
  setGeography: (geography: Geography | null) => void;
  setExaggeration: (exaggeration: number) => void;
  generation: (status: 'loading' | 'ready', stage: string) => void;
}>((set) => ({
  world: null,
  geography: null,
  exaggeration: 1,
  status: 'idle',
  stage: '',
  setWorld: (world) => set({ world, geography: null, status: 'ready' }),
  setGeography: (geography) => set({ geography }),
  setExaggeration: (exaggeration) =>
    set({ exaggeration: Math.max(0, Math.min(2, exaggeration)) }),
  generation: (status, stage) => set({ status, stage }),
}));
export type Playback =
  'Ready' | 'Transitioning' | 'Playing' | 'Paused' | 'Completing' | 'Completed';
export const useSimulationStore = create<{
  status: Playback;
  pausedFrom: 'Transitioning' | 'Playing' | 'Completing';
  elapsed: number;
  distance: number;
  waypoint: number;
  speed: number;
  movement: AnimationStep['type'];
  completion: number;
  resetToken: number;
  seekToken: number;
  setStatus: (status: Playback) => void;
  begin: () => void;
  pause: () => void;
  setSpeed: (speed: number) => void;
  seek: (elapsed: number) => void;
  showSummary: () => void;
  restart: () => void;
}>((set) => ({
  status: 'Ready',
  pausedFrom: 'Playing',
  elapsed: 0,
  distance: 0,
  waypoint: 0,
  speed: 1,
  movement: 'normal',
  completion: 0,
  resetToken: 0,
  seekToken: 0,
  setStatus: (status) => set({ status }),
  begin: () =>
    set((state) =>
      state.status === 'Ready'
        ? { status: 'Transitioning' }
        : state.status === 'Paused'
          ? { status: state.pausedFrom }
          : {},
    ),
  pause: () =>
    set((state) =>
      state.status === 'Playing' ||
      state.status === 'Transitioning' ||
      state.status === 'Completing'
        ? { status: 'Paused', pausedFrom: state.status }
        : {},
    ),
  setSpeed: (speed) => {
    if ([0.5, 1, 2, 4, 8].includes(speed)) set({ speed });
  },
  seek: (elapsed) => {
    if (Number.isFinite(elapsed))
      set((state) => ({
        elapsed: Math.max(0, elapsed),
        completion: 0,
        status: state.status === 'Playing' ? 'Playing' : 'Paused',
        pausedFrom: 'Playing',
        seekToken: state.seekToken + 1,
      }));
  },
  showSummary: () => set({ status: 'Completed', completion: 1 }),
  restart: () =>
    set((state) => ({
      status: 'Ready',
      pausedFrom: 'Playing',
      elapsed: 0,
      distance: 0,
      waypoint: 0,
      movement: 'normal',
      completion: 0,
      resetToken: state.resetToken + 1,
    })),
}));
