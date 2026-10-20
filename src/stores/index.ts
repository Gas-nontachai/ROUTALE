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
export type Playback = 'Ready' | 'Playing' | 'Paused' | 'Completed';
export const useSimulationStore = create<{
  status: Playback;
  elapsed: number;
  distance: number;
  waypoint: number;
  speed: number;
  movement: AnimationStep['type'];
  resetToken: number;
  setStatus: (status: Playback) => void;
  setSpeed: (speed: number) => void;
  update: (
    elapsed: number,
    total: number,
    distance?: number,
    waypoint?: number,
    movement?: AnimationStep['type'],
  ) => void;
  restart: () => void;
}>((set) => ({
  status: 'Ready',
  elapsed: 0,
  distance: 0,
  waypoint: 0,
  speed: 1,
  movement: 'normal',
  resetToken: 0,
  setStatus: (status) => set({ status }),
  setSpeed: (speed) => {
    if ([0.5, 1, 2, 4, 8].includes(speed)) set({ speed });
  },
  update: (
    elapsed,
    total,
    distance = elapsed,
    waypoint = 0,
    movement = 'normal',
  ) =>
    set({
      elapsed: Math.min(elapsed, total),
      distance,
      waypoint,
      movement,
      ...(elapsed >= total ? { status: 'Completed' as const } : {}),
    }),
  restart: () =>
    set((state) => ({
      status: 'Ready',
      elapsed: 0,
      distance: 0,
      waypoint: 0,
      movement: 'normal',
      resetToken: state.resetToken + 1,
    })),
}));
