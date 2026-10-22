import { afterEach, expect, it, vi } from 'vitest';
import { createWorld, parseGpx } from '../lib/route';
import { useMapStyleStore } from '../stores';

const harness = vi.hoisted(() => ({
  effects: [] as (() => undefined | (() => void))[],
  element: { clientWidth: 800, clientHeight: 360 },
  listeners: {} as Record<string, (() => void)[]>,
  resize: () => {},
  disconnect: vi.fn(),
  map: {
    on: vi.fn(),
    once: vi.fn(),
    getStyle: () => ({ layers: [] }),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    fitBounds: vi.fn(),
    isSourceLoaded: () => true,
    resize: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useRef: () => ({ current: harness.element }),
  useMemo: (fn: () => unknown) => fn(),
  useState: () => ['', vi.fn()],
  useEffect: (fn: () => undefined | (() => void)) => harness.effects.push(fn),
}));
vi.mock('maplibre-gl', () => ({
  setWorkerUrl: vi.fn(),
  Map: vi.fn(function () {
    return harness.map;
  }),
  LngLatBounds: vi.fn(function () {
    return { extend: vi.fn() };
  }),
}));
vi.mock('../lib/mapStyles', async (original) => ({
  ...(await original<typeof import('../lib/mapStyles')>()),
  applyMapStyle: vi.fn(),
}));
import { SummaryMap } from './SummaryMap';
import { Map as MapConstructor } from 'maplibre-gl';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('reuses its map when resized, ignores zero-size containers and releases resources', () => {
  const unsubscribe = vi.fn();
  vi.spyOn(useMapStyleStore, 'subscribe').mockReturnValue(unsubscribe);
  harness.map.on.mockImplementation((event: string, callback: () => void) => {
    (harness.listeners[event] ??= []).push(callback);
  });
  harness.map.once.mockImplementation((event: string, callback: () => void) => {
    (harness.listeners[event] ??= []).push(callback);
  });
  harness.map.remove.mockImplementation(() =>
    harness.listeners.remove?.forEach((fn) => fn()),
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        harness.resize = callback;
      }
      observe() {}
      disconnect = harness.disconnect;
    },
  );
  const world = createWorld(
    parseGpx(
      '<gpx><rte><rtept lat="0" lon="0"/><rtept lat="0" lon="0.01"/></rte></gpx>',
    ),
  );
  SummaryMap({ world });
  const cleanup = harness.effects[0]()!;
  harness.listeners['style.load'][0]();
  harness.resize();
  harness.element.clientWidth = 390;
  harness.resize();
  expect(MapConstructor).toHaveBeenCalledTimes(1);
  expect(harness.map.resize).toHaveBeenCalledTimes(2);
  expect(harness.map.fitBounds).toHaveBeenCalledTimes(3);
  harness.element.clientWidth = 0;
  harness.resize();
  expect(harness.map.resize).toHaveBeenCalledTimes(2);
  cleanup();
  expect(harness.disconnect).toHaveBeenCalledOnce();
  expect(harness.map.remove).toHaveBeenCalledOnce();
  expect(unsubscribe).toHaveBeenCalledOnce();
});
