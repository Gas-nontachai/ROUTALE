import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isMapStyle, type MapStyle } from '../lib/mapStyles';
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
export type { Playback } from '../lib/playback';
import type { Playback } from '../lib/playback';
export const useSimulationStore = create<{
  status: Playback;
  elapsed: number;
  distance: number;
  waypoint: number;
  speed: number;
  movement: AnimationStep['type'];
  completion: number;
  transitionProgress: number;
  resetToken: number;
  seekToken: number;
  command: 'begin' | 'pause' | 'summary' | null;
  commandToken: number;
  begin: () => void;
  pause: () => void;
  setSpeed: (speed: number) => void;
  seek: (elapsed: number) => void;
  showSummary: () => void;
  restart: () => void;
}>((set) => ({
  status: 'Ready',
  elapsed: 0,
  distance: 0,
  waypoint: 0,
  speed: 1,
  movement: 'normal',
  completion: 0,
  transitionProgress: 0,
  resetToken: 0,
  seekToken: 0,
  command: null,
  commandToken: 0,
  begin: () =>
    set((state) =>
      state.status === 'Ready' || state.status === 'Paused'
        ? { command: 'begin', commandToken: state.commandToken + 1 }
        : {},
    ),
  pause: () =>
    set((state) =>
      ['Playing', 'Transitioning', 'Completing'].includes(state.status)
        ? { command: 'pause', commandToken: state.commandToken + 1 }
        : {},
    ),
  setSpeed: (speed) => {
    if ([0.5, 1, 2, 4, 8].includes(speed)) set({ speed });
  },
  seek: (elapsed) => {
    if (Number.isFinite(elapsed))
      set((state) => ({
        elapsed: Math.max(0, elapsed),
        seekToken: state.seekToken + 1,
      }));
  },
  showSummary: () =>
    set((state) => ({
      command: 'summary',
      commandToken: state.commandToken + 1,
    })),
  restart: () =>
    set((state) => ({
      status: 'Ready',
      elapsed: 0,
      distance: 0,
      waypoint: 0,
      movement: 'normal',
      completion: 0,
      transitionProgress: 0,
      command: null,
      resetToken: state.resetToken + 1,
    })),
}));

export const useMapStyleStore = create<{
  style: MapStyle;
  setStyle: (style: MapStyle) => void;
}>()(
  persist(
    (set) => ({
      style: 'default',
      setStyle: (style) => {
        if (isMapStyle(style)) set({ style });
      },
    }),
    {
      name: 'gpx-map-style',
      merge: (saved, current) => {
        const style = (saved as { style?: unknown } | null)?.style;
        return { ...current, style: isMapStyle(style) ? style : 'default' };
      },
    },
  ),
);
