import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cameraOwner } from '../lib/camera';
import { completionPresentation, motionProfile } from '../lib/motion';
import {
  configureTerrain,
  drawnTerrainElevation,
  terrainProfile,
} from '../lib/terrain';
import { unproject } from '../lib/route';
import {
  routeCoordinates,
  routeBounds,
  visibleRoute,
  travelerFacing,
} from '../lib/map';
import type { JourneyEngine } from '../hooks/useJourney';
import { useSimulationStore, useMapStyleStore } from '../stores';
import {
  Compass,
  Layers,
  LocateFixed,
  Settings,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  applyMapStyle,
  mapStyleMaxZoom,
  mapStyles,
  satelliteSource,
  type BaseLayer,
  type MapStyle,
} from '../lib/mapStyles';
import { Button } from '../components/ui/button';
maplibregl.setWorkerUrl(workerUrl);
const terrainMaxZoom = navigator.hardwareConcurrency <= 4 ? 10 : 12;
const fallbackStyle: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#e9ede4' },
    },
    { id: 'osm', type: 'raster', source: 'osm' },
  ],
};

export function RouteMap({ engine }: { engine: JourneyEngine }) {
  const world = engine.journey.world;
  const host = useRef<HTMLDivElement>(null),
    mapRef = useRef<MapLibreMap | null>(null),
    configureTerrainRef = useRef<
      (enabled: boolean, exaggeration: number) => void
    >(() => {});
  const [exaggeration, setExaggeration] = useState<number>(
    terrainProfile.exaggeration,
  );
  const exaggerationRef = useRef(exaggeration);
  exaggerationRef.current = exaggeration;
  const status = useSimulationStore((state) => state.status);
  const isPlaying = ['Playing', 'Transitioning', 'Completing'].includes(status);
  const { style, setStyle } = useMapStyleStore();
  const [layersOpen, setLayersOpen] = useState(false);
  const [bearing, setBearing] = useState(0);
  const [styleLoading, setStyleLoading] = useState(false);
  const [styleError, setStyleError] = useState('');
  const layersButton = useRef<HTMLButtonElement>(null);
  const controlsMenu = useRef<HTMLDivElement>(null);
  const canSwitchStyle = cameraOwner(status) === 'user';
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState(
    'Loading OpenFreeMap and Mapterhorn terrain…',
  );
  const [terrain, setTerrain] = useState(true);
  const terrainEnabled = useRef(true);
  useEffect(() => {
    if (!layersOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!controlsMenu.current?.contains(event.target as Node)) {
        setLayersOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLayersOpen(false);
        layersButton.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [layersOpen]);
  useEffect(() => {
    if (!host.current) return;
    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
        container: host.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: engine.frame.camera.center,
        zoom: engine.frame.camera.zoom,
        pitch: engine.frame.camera.pitch,
        bearing: engine.frame.camera.bearing,
        maxPitch: motionProfile.maxPitch,
        minZoom: motionProfile.minZoom,
        maxZoom: motionProfile.maxZoom,
        canvasContextAttributes: { antialias: true },
        attributionControl: false,
      });
    } catch {
      setMessage(
        'This device cannot render the map. You can still play the journey or view its summary.',
      );
      return;
    }
    mapRef.current = map;
    const summaryBounds = routeBounds(world);
    const container = host.current.closest('.simulation-canvas');
    let summarySize = '',
      summaryFrame = 0,
      summaryActive = completionPresentation(
        engine.frame.completionProgress,
      ).summary;
    const revealSummary = () => {
      container?.classList.remove('summary-pending');
    };
    const fitSummary = () => {
      if (
        !summaryActive ||
        !loaded ||
        !container?.classList.contains('show-summary')
      )
        return;
      const size = `${host.current?.clientWidth}:${host.current?.clientHeight}`;
      if (size === summarySize) return;
      summarySize = size;
      map.resize();
      container.classList.add('summary-pending');
      map.off('render', revealSummary);
      map.setMinZoom(0);
      map.setCenterClampedToGround(true);
      map.jumpTo({ bearing: 0, pitch: 0 });
      map.fitBounds(summaryBounds, {
        padding: 40,
        maxZoom: 16,
        bearing: 0,
        pitch: 0,
        duration: 0,
      });
      // Reveal both layers after the resized map has painted, without waiting for network idle.
      map.once('render', revealSummary);
    };
    const resize = new ResizeObserver(() => {
      map.resize();
      fitSummary();
    });
    resize.observe(host.current);
    let owner = 'user';
    const setOwnership = (next: string) => {
      owner = next;
      const free = next === 'user';
      if (!free) map.setCenterClampedToGround(false);
      for (const handler of [
        map.dragPan,
        map.dragRotate,
        map.scrollZoom,
        map.touchZoomRotate,
        map.touchPitch,
        map.boxZoom,
        map.doubleClickZoom,
        map.keyboard,
      ]) {
        if (free) handler.enable();
        else handler.disable();
      }
      for (const group of map
        .getContainer()
        .querySelectorAll<HTMLElement>('.maplibregl-ctrl-group'))
        group.inert = !free;
    };
    // Releasing ownership preserves the exact view; terrain clamping resumes with the next user gesture.
    const userInput = () => {
      if (owner === 'user') map.setCenterClampedToGround(true);
    };
    const inputEvents = [
      'pointerdown',
      'touchstart',
      'wheel',
      'keydown',
    ] as const;
    for (const event of inputEvents)
      map
        .getContainer()
        .addEventListener(event, userInput, { capture: true, passive: true });
    const disconnect = engine.connect({
      read: () => {
        // Summary framing belongs to the renderer, never to the playback camera.
        if (summaryActive) return engine.frame.camera;
        const center = map.getCenter();
        return {
          center: [center.lng, center.lat],
          zoom: map.getZoom(),
          bearing: map.getBearing(),
          pitch: map.getPitch(),
          elevation: map.getCenterElevation(),
        };
      },
      stop: () => {
        if (summaryActive) {
          summarySize = '';
          map.setMinZoom(motionProfile.minZoom);
          map.jumpTo({
            ...engine.frame.camera,
            pitch: terrainEnabled.current ? engine.frame.camera.pitch : 0,
            elevation: terrainEnabled.current
              ? engine.frame.camera.elevation
              : 0,
          });
        }
        setOwnership('timeline');
        map.stop();
      },
      environment: () => ({
        enabled: terrainEnabled.current,
        sample: (center) => drawnTerrainElevation(map, center),
        height: map.getCanvas().clientHeight,
        fov: map.getVerticalFieldOfView(),
      }),
    });
    const element = document.createElement('div');
    element.className =
      'grid h-[38px] w-7 place-items-center border-0 bg-transparent shadow-none [&_svg]:block [&_svg]:drop-shadow-[0_2px_2px_#173b3277] [&_.left-leg]:[transform:translateY(var(--stride,0px))] [&_.right-leg]:[transform:translateY(calc(-1*var(--stride,0px)))] [&_.side-face]:hidden [&_.back-view]:hidden [&[data-facing=back]_.front-face]:hidden [&[data-facing=left]_.front-face]:hidden [&[data-facing=right]_.front-face]:hidden [&[data-facing=back]_.back-view]:[display:initial] [&[data-facing=left]_.side-face]:[display:initial] [&[data-facing=right]_.side-face]:[display:initial] [&[data-facing=left]_svg]:scale-x-[-1]';
    element.setAttribute('role', 'img');
    element.setAttribute('aria-label', 'Traveler on the route');
    element.innerHTML =
      '<svg class="traveler" viewBox="0 0 28 38" width="28" height="38" aria-hidden="true"><circle cx="14" cy="7" r="5" fill="#ffe2ad"/><path d="M9 14h10l2 13H7z" fill="#f4bb4b"/><path d="M8 16l-5 9m17-9 5 9" stroke="#ffe2ad" stroke-width="4" stroke-linecap="round"/><path class="left-leg" d="M10 26v9" stroke="#173b32" stroke-width="5" stroke-linecap="round"/><path class="right-leg" d="M18 26v9" stroke="#173b32" stroke-width="5" stroke-linecap="round"/><g class="front-face" fill="#173b32"><circle cx="12" cy="7" r="0.9"/><circle cx="16" cy="7" r="0.9"/></g><g class="side-face"><path d="M18 6l4 3h-4z" fill="#ffe2ad"/><circle cx="17" cy="6" r="0.9" fill="#173b32"/></g><g class="back-view"><path d="M9 4q5-5 10 0v4H9z" fill="#543e2c"/><rect x="9" y="15" width="10" height="11" rx="2" fill="#587b64" stroke="#173b32" stroke-width="1.5"/></g></svg>';
    const character = new maplibregl.Marker({
      element,
      anchor: 'bottom',
      subpixelPositioning: true,
      rotationAlignment: 'viewport',
      pitchAlignment: 'viewport',
    })
      .setLngLat(engine.frame.camera.center)
      .addTo(map);
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120 }));
    map
      .getContainer()
      .querySelector('.maplibregl-ctrl-scale')
      ?.classList.add(
        '!mb-1',
        '!relative',
        '!border-x-0',
        '!border-t-0',
        '!border-b-2',
        '!border-white',
        '!bg-transparent',
        '!px-0',
        '!pb-1',
        '!text-xs',
        '!font-semibold',
        '!text-white',
        '[text-shadow:0_1px_3px_#142a20]',
        'before:absolute',
        'before:bottom-0',
        'before:left-0',
        'before:h-2',
        'before:border-l-2',
        'before:border-white',
        "before:content-['']",
        'after:absolute',
        'after:bottom-0',
        'after:right-0',
        'after:h-2',
        'after:border-r-2',
        'after:border-white',
        "after:content-['']",
      );
    let terrainTimeout: ReturnType<typeof setTimeout> | undefined;
    let terrainState: 'loading' | 'ready' | 'off' | 'error' = 'loading';
    const failTerrain = (reason: string) => {
      clearTimeout(terrainTimeout);
      terrainState = 'error';
      terrainEnabled.current = false;
      setTerrain(false);
      configureTerrain(map, false, exaggerationRef.current, terrainMaxZoom);
      map.setPitch(0);
      setMessage(`${reason} · using the 2D map. You can retry 3D terrain.`);
    };
    const applyTerrain = (enabled: boolean, factor: number) => {
      clearTimeout(terrainTimeout);
      terrainEnabled.current = enabled;
      try {
        configureTerrain(map, enabled, factor, terrainMaxZoom);
        terrainState = enabled ? 'loading' : 'off';
        setMessage(enabled ? 'Loading terrain DEM…' : 'Terrain off · 2D map');
        if (!enabled) map.setPitch(0);
        if (enabled)
          terrainTimeout = setTimeout(
            () => failTerrain('Terrain DEM did not become available'),
            terrainProfile.loadTimeout,
          );
      } catch {
        failTerrain('Terrain unavailable');
      }
    };
    configureTerrainRef.current = applyTerrain;
    const installTerrain = () =>
      applyTerrain(terrainEnabled.current, exaggerationRef.current);
    const verifyTerrain = () => {
      if (!terrainEnabled.current) return;
      const center = map.getCenter();
      const height = drawnTerrainElevation(map, [center.lng, center.lat]);
      if (height !== undefined && Number.isFinite(height)) {
        clearTimeout(terrainTimeout);
        if (terrainState !== 'ready') {
          terrainState = 'ready';
          setMessage(
            `3D terrain verified · DEM rendered · ${exaggerationRef.current.toFixed(1)}× relief`,
          );
        }
      } else if (terrainState === 'ready') {
        terrainState = 'loading';
        setMessage('Loading terrain DEM for this view…');
        terrainTimeout = setTimeout(
          () => failTerrain('Terrain DEM did not become available'),
          terrainProfile.loadTimeout,
        );
      }
    };
    map.on('render', verifyTerrain);
    const installRoute = () => {
      if (!map.getSource('activity-route'))
        map.addSource('activity-route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'MultiLineString',
              coordinates: routeCoordinates(world),
            },
          },
        });
      if (!map.getSource('travelled-route'))
        map.addSource('travelled-route', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
      if (!map.getSource('route-spots'))
        map.addSource('route-spots', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: world.spots
              .filter((spot) => spot.type !== 'rest')
              .map((spot) => ({
                type: 'Feature' as const,
                properties: { kind: spot.type, label: spot.label },
                geometry: {
                  type: 'Point' as const,
                  coordinates: (() => {
                    const position = unproject(world, spot.x, spot.y);
                    return [position.lon, position.lat];
                  })(),
                },
              })),
          },
        });
      if (!map.getLayer('route-outline'))
        map.addLayer({
          id: 'route-outline',
          type: 'line',
          source: 'activity-route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#173b32',
            'line-width': 8,
            'line-opacity': 0.9,
          },
        });
      if (!map.getLayer('route-line'))
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'activity-route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#f1b84b', 'line-width': 4 },
        });
      if (!map.getLayer('travelled-line'))
        map.addLayer({
          id: 'travelled-line',
          type: 'line',
          source: 'travelled-route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#f16e42', 'line-width': 5 },
        });
      if (!map.getLayer('route-spots'))
        map.addLayer({
          id: 'route-spots',
          type: 'circle',
          source: 'route-spots',
          paint: {
            'circle-pitch-alignment': 'map',
            'circle-pitch-scale': 'map',
            'circle-radius': [
              'match',
              ['get', 'kind'],
              'start',
              7,
              'finish',
              7,
              5,
            ],
            'circle-color': [
              'match',
              ['get', 'kind'],
              'start',
              '#347a5b',
              'finish',
              '#ca543c',
              'loop',
              '#a06cbd',
              '#db9c35',
            ],
            'circle-stroke-color': '#fffdf2',
            'circle-stroke-width': 2,
          },
        });
      if (!map.getLayer('summary-endpoints'))
        map.addLayer({
          id: 'summary-endpoints',
          type: 'circle',
          source: 'route-spots',
          filter: ['in', ['get', 'kind'], ['literal', ['start', 'finish']]],
          layout: { visibility: 'none' },
          paint: {
            'circle-radius': 3,
            'circle-pitch-alignment': 'viewport',
            'circle-pitch-scale': 'viewport',
            'circle-color': [
              'match',
              ['get', 'kind'],
              'start',
              '#6f927b',
              '#c58b65',
            ],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1,
          },
        });
      summarySize = '';
      installTerrain();
    };
    let loaded = false,
      fallbackStarted = false,
      lastDistance = -1;
    let baseLayers: BaseLayer[] = [];
    let appliedStyle: MapStyle = 'default',
      pendingStyle: MapStyle | null = null;
    let styleTimeout: ReturnType<typeof setTimeout> | undefined;
    const finishStyle = () => {
      if (
        !pendingStyle ||
        (pendingStyle !== 'default' && !map.isSourceLoaded('satellite-imagery'))
      )
        return;
      applyMapStyle(map, pendingStyle, baseLayers);
      appliedStyle = pendingStyle;
      pendingStyle = null;
      clearTimeout(styleTimeout);
      setStyleLoading(false);
    };
    const failStyle = (reason: string) => {
      if (!pendingStyle) return;
      pendingStyle = null;
      clearTimeout(styleTimeout);
      applyMapStyle(map, appliedStyle, baseLayers);
      map.setMaxZoom(mapStyleMaxZoom(appliedStyle, motionProfile.maxZoom));
      setStyleLoading(false);
      useMapStyleStore.getState().setStyle(appliedStyle);
      setStyleError(reason);
    };
    const requestStyle = (next: MapStyle) => {
      if (!loaded || (next === appliedStyle && !pendingStyle)) return;
      clearTimeout(styleTimeout);
      pendingStyle = next;
      const maxZoom = mapStyleMaxZoom(next, motionProfile.maxZoom);
      map.setMaxZoom(maxZoom);
      if (map.getZoom() > maxZoom) map.easeTo({ zoom: maxZoom, duration: 500 });
      setStyleError('');
      if (next !== 'default')
        map.setLayoutProperty('satellite-imagery', 'visibility', 'visible');
      finishStyle();
      if (pendingStyle) {
        setStyleLoading(true);
        styleTimeout = setTimeout(
          () =>
            failStyle(
              'Satellite tiles are unavailable. The previous style is still active.',
            ),
          12000,
        );
      }
    };
    map.on('sourcedata', (event) => {
      if (event.sourceId === 'satellite-imagery' && event.isSourceLoaded)
        finishStyle();
    });
    const unsubscribeStyle = useMapStyleStore.subscribe((state, previous) => {
      if (state.style !== previous.style) requestStyle(state.style);
    });
    const render = (frame: JourneyEngine['frame']) => {
      if (pendingStyle && frame.owner !== 'user')
        failStyle(
          'Style loading was canceled when playback started. Pause to try again.',
        );
      const wasSummary = summaryActive;
      summaryActive = completionPresentation(frame.completionProgress).summary;
      if (owner !== frame.owner) setOwnership(frame.owner);
      element.hidden = summaryActive;
      if (!loaded) return;
      map.setLayoutProperty(
        'summary-endpoints',
        'visibility',
        summaryActive ? 'visible' : 'none',
      );
      if (!summaryActive) {
        summarySize = '';
        cancelAnimationFrame(summaryFrame);
        map.off('render', revealSummary);
        revealSummary();
      }
      map.setLayoutProperty(
        'route-spots',
        'visibility',
        summaryActive ? 'none' : 'visible',
      );
      map.setLayoutProperty(
        'travelled-line',
        'visibility',
        summaryActive ? 'none' : 'visible',
      );
      if (summaryActive && (!wasSummary || !summarySize)) {
        container?.classList.add('summary-pending');
        summaryFrame = requestAnimationFrame(fitSummary);
      }
      const position = unproject(world, frame.position.x, frame.position.y);
      character.setLngLat([position.lon, position.lat]);
      element.style.setProperty(
        '--stride',
        `${Math.sin(frame.elapsed * 12) * (frame.position.movement === 'stay' || frame.completionProgress > 0 || engine.journey.reducedMotion ? 0 : 2)}px`,
      );
      if (!summaryActive && (frame.owner === 'timeline' || wasSummary))
        map.jumpTo({
          center: frame.camera.center,
          zoom: frame.camera.zoom,
          bearing: frame.camera.bearing,
          pitch: terrainEnabled.current ? frame.camera.pitch : 0,
          elevation: terrainEnabled.current ? frame.camera.elevation : 0,
        });
      updateFacing();
      const route = map.getSource('travelled-route') as
        GeoJSONSource | undefined;
      if (
        route &&
        (Math.abs(frame.position.distance - lastDistance) >
          Math.max(1, world.distance / 1500) ||
          frame.elapsed === world.duration ||
          frame.elapsed === 0)
      ) {
        route.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'MultiLineString',
            coordinates: visibleRoute(world, frame.position.distance),
          },
        });
        lastDistance = frame.position.distance;
      }
    };
    const updateFacing = () => {
      element.dataset.facing = travelerFacing(
        engine.frame.direction,
        map.getBearing(),
      );
    };
    map.on('rotate', updateFacing);
    const updateBearing = () => setBearing(map.getBearing());
    map.on('rotate', updateBearing);
    map.on('moveend', updateBearing);
    map.on('style.load', () => {
      baseLayers = map.getStyle().layers.map((layer) => ({
        id: layer.id,
        type: layer.type,
        visibility: layer.layout?.visibility === 'none' ? 'none' : 'visible',
      }));
      appliedStyle = 'default';
      map.addSource('satellite-imagery', satelliteSource);
      map.addLayer(
        {
          id: 'satellite-imagery',
          type: 'raster',
          source: 'satellite-imagery',
          layout: { visibility: 'none' },
          paint: { 'raster-fade-duration': 0 },
        },
        baseLayers.find((layer) => layer.type !== 'background')?.id,
      );
      installRoute();
      loaded = true;
      setReady(true);
      requestStyle(useMapStyleStore.getState().style);
      render(engine.frame);
      fitSummary();
    });
    map.on('error', (event) => {
      const sourceId = (event as maplibregl.ErrorEvent & { sourceId?: string })
        .sourceId;
      if (sourceId === 'satellite-imagery') {
        failStyle(
          'Satellite tiles could not be loaded. The previous style is still active.',
        );
        return;
      }
      if (
        sourceId === 'terrain-dem' ||
        (!sourceId && /mapterhorn|terrain/i.test(event.error.message))
      ) {
        if (terrainEnabled.current) failTerrain('Terrain tiles unavailable');
      } else if (sourceId === 'hillshade-dem') {
        if (!terrainEnabled.current) return;
        if (map.getLayer('terrain-hillshade'))
          map.setLayoutProperty('terrain-hillshade', 'visibility', 'none');
        setMessage(
          'Hillshade unavailable · terrain remains enabled; verifying DEM.',
        );
      } else if (!map.isStyleLoaded() && !fallbackStarted) {
        fallbackStarted = true;
        clearTimeout(terrainTimeout);
        terrainState = 'off';
        map.setPitch(0);
        terrainEnabled.current = false;
        setTerrain(false);
        setMessage('Base map unavailable · switching to the 2D fallback.');
        map.setStyle(fallbackStyle);
      } else {
        setMessage(
          'Some map resources are unavailable. Journey controls and summary remain available.',
        );
      }
    });
    const timeout = window.setTimeout(() => {
      if (!loaded)
        setMessage(
          'Map loading is taking longer than expected. You can view the summary at any time.',
        );
    }, 15000);
    const unsubscribe = engine.subscribe(render);
    return () => {
      unsubscribeStyle();
      clearTimeout(styleTimeout);
      cancelAnimationFrame(summaryFrame);
      map.off('render', revealSummary);
      map.off('rotate', updateBearing);
      map.off('moveend', updateBearing);
      revealSummary();
      clearTimeout(timeout);
      clearTimeout(terrainTimeout);
      configureTerrainRef.current = () => {};
      unsubscribe();
      disconnect();
      for (const event of inputEvents)
        map.getContainer().removeEventListener(event, userInput, true);
      character.remove();
      resize.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [engine, world]);
  return (
    <div
      className="size-full overflow-hidden bg-surface-muted"
      ref={host}
      style={{ containerType: 'size' }}
      aria-label={
        status === 'Completed'
          ? 'Top-down overview of the complete GPX route'
          : 'Interactive 3D map with GPX route'
      }
    >
      {!ready && (
        <div
          className="absolute left-1/2 top-1/2 z-[3] -translate-x-1/2 -translate-y-1/2 bg-[#fffdf2ed] px-4 py-3 text-xs text-foreground"
          role="status"
        >
          {message}
        </div>
      )}
      {styleError && (
        <p
          className="absolute bottom-3 left-3 z-[3] bg-red-50 px-3 py-2 text-xs text-red-800 shadow"
          role="status"
        >
          {styleError}
        </p>
      )}
      <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex justify-end sm:inset-x-3 sm:top-3">
        <div
          ref={controlsMenu}
          inert={isPlaying}
          aria-hidden={isPlaying}
          className={`relative flex items-center rounded-full border border-white/30 bg-[#195847] p-1 text-white transition-opacity duration-300 motion-reduce:transition-none ${isPlaying ? 'pointer-events-none opacity-0' : 'pointer-events-auto opacity-100'}`}
        >
          <div id="map-controls-menu" className="flex min-w-0 items-center">
            <div
              className="flex items-center justify-between gap-0"
              role="group"
              aria-label="Map controls"
            >
              <Button
                variant="mapControl"
                type="button"
                className="grid size-11 shrink-0 place-items-center rounded-full transition"
                aria-label="Zoom out"
                title="Zoom out"
                disabled={!ready || !canSwitchStyle}
                onClick={() =>
                  mapRef.current?.easeTo({
                    zoom: mapRef.current.getZoom() - 1,
                    duration: 500,
                  })
                }
              >
                <ZoomOut />
              </Button>
              <Button
                variant="mapControl"
                type="button"
                className="grid size-11 shrink-0 place-items-center rounded-full transition"
                aria-label="Zoom in"
                title="Zoom in"
                disabled={!ready || !canSwitchStyle}
                onClick={() =>
                  mapRef.current?.easeTo({
                    zoom: mapRef.current.getZoom() + 1,
                    duration: 500,
                  })
                }
              >
                <ZoomIn />
              </Button>
              <Button
                variant="mapControl"
                type="button"
                className="grid size-11 shrink-0 place-items-center rounded-full transition"
                aria-label={`Reset compass to north; current bearing ${Math.round(bearing)} degrees`}
                title={`Bearing ${Math.round(bearing)}° · reset north`}
                disabled={!ready || !canSwitchStyle}
                onClick={() =>
                  mapRef.current?.easeTo({ bearing: 0, duration: 500 })
                }
              >
                <Compass style={{ transform: `rotate(${-bearing}deg)` }} />
              </Button>
              <Button
                variant="mapControl"
                type="button"
                className="grid size-11 shrink-0 place-items-center rounded-full transition"
                aria-label="Fit route"
                title="Fit route"
                disabled={!ready || !canSwitchStyle}
                onClick={() =>
                  mapRef.current?.fitBounds(routeBounds(world), {
                    padding: 72,
                    maxZoom: mapStyleMaxZoom(style, 15),
                    duration: 700,
                  })
                }
              >
                <LocateFixed />
              </Button>
              <Button
                variant={layersOpen ? 'mapSelected' : 'mapControl'}
                type="button"
                className="grid size-11 shrink-0 place-items-center rounded-full transition"
                aria-label="Layers and view options"
                title="Layers and view options"
                ref={layersButton}
                aria-controls="map-settings"
                aria-expanded={layersOpen}
                onClick={() => setLayersOpen(!layersOpen)}
              >
                <Layers size={20} />
              </Button>
            </div>
          </div>
          {layersOpen && (
            <section
              className="absolute right-0 top-full z-10 w-[min(320px,calc(100vw-24px))] pt-2"
              id="map-settings"
              aria-label="Map settings"
            >
              <div className="map-settings-content overflow-y-auto rounded-lg border border-line bg-surface p-3 text-foreground shadow-sm">
                <header className="mb-3 flex items-center justify-between">
                  <strong className="flex items-center gap-2 text-sm">
                    <Settings size={16} aria-hidden="true" /> Map
                  </strong>
                  <Button
                    variant="ghost"
                    type="button"
                    className="size-11 rounded-lg p-2"
                    aria-label="Close map settings"
                    onClick={() => {
                      setLayersOpen(false);
                      layersButton.current?.focus();
                    }}
                  >
                    <X size={18} />
                  </Button>
                </header>
                <p className="my-2 text-xs font-semibold">Style</p>
                <div className="grid grid-cols-3 gap-1">
                  {mapStyles.map((option) => (
                    <Button
                      variant="mapStyle"
                      key={option}
                      className="flex min-h-[76px] flex-col gap-1 rounded-lg p-1 text-xs"
                      aria-pressed={style === option}
                      disabled={!canSwitchStyle || styleLoading}
                      onClick={() => {
                        if (cameraOwner(engine.state) !== 'user') return;
                        setStyle(option);
                      }}
                    >
                      <span
                        className="h-10 w-full rounded-md border border-line bg-cover bg-center"
                        aria-hidden="true"
                        style={{
                          backgroundImage:
                            option === 'default'
                              ? 'linear-gradient(125deg, transparent 42%, #f7f6eb 43% 53%, transparent 54%),linear-gradient(25deg, transparent 33%, #83b8c2 34% 45%, #a9c3a1 46%)'
                              : `${option === 'hybrid' ? 'linear-gradient(125deg, transparent 42%, #f7f6eb 43% 48%, transparent 49%),' : ''}url(https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/7/57/100.jpg)`,
                        }}
                      />
                      {option[0].toUpperCase() + option.slice(1)}
                    </Button>
                  ))}
                </div>
                <label className="flex min-h-11 items-center justify-between border-t border-line text-xs">
                  <span>3D Terrain</span>
                  <input
                    className="size-[18px] accent-[#3e7152]"
                    type="checkbox"
                    checked={terrain}
                    disabled={!ready || !canSwitchStyle}
                    onChange={(event) => {
                      const enabled = event.target.checked;
                      terrainEnabled.current = enabled;
                      setTerrain(enabled);
                      mapRef.current &&
                        configureTerrainRef.current(
                          enabled,
                          exaggerationRef.current,
                        );
                    }}
                  />
                </label>
                <label className="flex min-h-11 items-center justify-between gap-2 border-t border-line text-xs">
                  <span>Terrain scale</span>
                  <select
                    className="min-h-11 rounded-lg border border-line bg-surface px-2 py-1"
                    aria-label="Terrain exaggeration"
                    value={exaggeration}
                    disabled={!ready || !terrain || !canSwitchStyle}
                    onChange={(event) => {
                      const factor = Number(event.target.value);
                      if (
                        !Number.isFinite(factor) ||
                        factor < terrainProfile.minExaggeration ||
                        factor > terrainProfile.maxExaggeration
                      )
                        return;
                      exaggerationRef.current = factor;
                      setExaggeration(factor);
                      configureTerrainRef.current(true, factor);
                    }}
                  >
                    {[1, 1.5, 2].map((factor) => (
                      <option key={factor} value={factor}>
                        {factor}×
                      </option>
                    ))}
                  </select>
                </label>
                <p className="mt-3 text-xs text-muted">
                  {canSwitchStyle
                    ? 'Drag to explore.'
                    : 'Pause to edit the map.'}
                </p>
                {styleLoading && (
                  <small className="block px-2 py-1.5 text-xs text-muted">
                    Loading style…
                  </small>
                )}
                {styleError && (
                  <small
                    className="block px-2 py-1.5 text-xs text-muted"
                    role="status"
                  >
                    {styleError}
                  </small>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
