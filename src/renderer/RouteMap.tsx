import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildJourney } from '../lib/journey';
import { motionProfile } from '../lib/motion';
import {
  configureTerrain,
  drawnTerrainElevation,
  terrainProfile,
} from '../lib/terrain';
import { projectGeo, unproject } from '../lib/route';
import { routeCoordinates, visibleRoute } from '../lib/map';
import type { JourneyEngine } from '../hooks/useJourney';
import { useSimulationStore } from '../stores';
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
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState(
    'Loading OpenFreeMap and Mapterhorn terrain…',
  );
  const [terrain, setTerrain] = useState(true);
  const terrainEnabled = useRef(true);
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
      });
    } catch {
      setMessage(
        'This device cannot render the map. You can still play the journey or view its summary.',
      );
      return;
    }
    mapRef.current = map;
    const element = document.createElement('div');
    element.className = 'route-character-marker';
    element.setAttribute('role', 'img');
    element.setAttribute('aria-label', 'Traveler on the route');
    element.innerHTML =
      '<svg class="traveler" viewBox="0 0 28 38" width="28" height="38" aria-hidden="true"><circle cx="14" cy="7" r="5" fill="#ffe2ad"/><path d="M9 14h10l2 13H7z" fill="#f4bb4b"/><path d="M8 16l-5 9m17-9 5 9" stroke="#ffe2ad" stroke-width="4" stroke-linecap="round"/><path class="left-leg" d="M10 26v9" stroke="#173b32" stroke-width="5" stroke-linecap="round"/><path class="right-leg" d="M18 26v9" stroke="#173b32" stroke-width="5" stroke-linecap="round"/></svg>';
    const character = new maplibregl.Marker({
      element,
      anchor: 'bottom',
      subpixelPositioning: true,
      rotationAlignment: 'map',
      pitchAlignment: 'viewport',
    })
      .setLngLat(engine.frame.camera.center)
      .addTo(map);
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }));
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120 }));
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
        if (useSimulationStore.getState().status === 'Ready')
          map.setPitch(enabled ? motionProfile.obliquePitch : 0);
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
            features: world.spots.map((spot) => ({
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
              'rest',
              '#5579a4',
              'loop',
              '#a06cbd',
              '#db9c35',
            ],
            'circle-stroke-color': '#fffdf2',
            'circle-stroke-width': 2,
          },
        });
      installTerrain();
    };
    let loaded = false,
      fallbackStarted = false,
      lastDistance = -1;
    const render = (frame: JourneyEngine['frame']) => {
      if (!loaded) return;
      const position = unproject(world, frame.position.x, frame.position.y);
      character
        .setLngLat([position.lon, position.lat])
        .setRotation(frame.direction);
      element.style.setProperty(
        '--stride',
        `${Math.sin(frame.elapsed * 12) * (frame.position.movement === 'stay' || frame.completionProgress > 0 || engine.journey.reducedMotion ? 0 : 2)}px`,
      );
      const state = useSimulationStore.getState();
      if (state.status !== 'Ready')
        map.jumpTo({
          center: frame.camera.center,
          zoom: frame.camera.zoom,
          bearing: frame.camera.bearing,
          pitch: terrainEnabled.current ? frame.camera.pitch : 0,
        });
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
    map.on('style.load', () => {
      installRoute();
      loaded = true;
      setReady(true);
      render(engine.frame);
    });
    map.on('error', (event) => {
      const sourceId = (event as maplibregl.ErrorEvent & { sourceId?: string })
        .sourceId;
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
    map.on('moveend', (event) => {
      // DEM loading and programmatic resets must not rewrite the prepared overview.
      if (
        useSimulationStore.getState().status !== 'Ready' ||
        !event.originalEvent
      )
        return;
      const point = projectGeo(world, {
        lat: map.getCenter().lat,
        lon: map.getCenter().lng,
      });
      Object.assign(
        engine.journey,
        buildJourney(world, engine.journey.reducedMotion, {
          x: point.x,
          y: point.y,
          bearing: map.getBearing(),
          pitch: map.getPitch(),
          zoom: map.getZoom(),
          mode: 'Wide',
        }),
      );
    });
    const timeout = window.setTimeout(() => {
      if (!loaded)
        setMessage(
          'Map loading is taking longer than expected. You can view the summary at any time.',
        );
    }, 15000);
    const unsubscribe = engine.subscribe(render);
    const unsubscribeState = useSimulationStore.subscribe((state, previous) => {
      if (state.resetToken !== previous.resetToken) {
        const view = engine.journey.overview;
        const geo = unproject(world, view.x, view.y);
        map.stop();
        map.jumpTo({
          center: [geo.lon, geo.lat],
          zoom: view.zoom,
          bearing: view.bearing,
          pitch: terrainEnabled.current ? view.pitch : 0,
        });
      }
    });
    return () => {
      clearTimeout(timeout);
      clearTimeout(terrainTimeout);
      configureTerrainRef.current = () => {};
      unsubscribe();
      unsubscribeState();
      character.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [engine, world]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const button of map
      .getContainer()
      .querySelectorAll<HTMLButtonElement>('.maplibregl-ctrl-group button'))
      button.disabled = status !== 'Ready';
    for (const group of map
      .getContainer()
      .querySelectorAll<HTMLElement>('.maplibregl-ctrl-group'))
      group.inert = status !== 'Ready';
    // Playback owns the camera; gestures only control the route preview.
    for (const handler of [
      map.dragPan,
      map.dragRotate,
      map.scrollZoom,
      map.touchZoomRotate,
      map.doubleClickZoom,
      map.keyboard,
    ]) {
      if (status === 'Ready') handler.enable();
      else handler.disable();
    }
  }, [status, ready]);
  return (
    <div
      className="route-map"
      ref={host}
      aria-label="Interactive 3D map with GPX route"
    >
      {!ready && (
        <div className="map-loading" role="status">
          {message}
        </div>
      )}
      <div className="map-toolbar" role="group" aria-label="Map settings">
        <label className="terrain-toggle">
          <input
            type="checkbox"
            checked={terrain}
            disabled={!ready || status !== 'Ready'}
            onChange={(event) => {
              const enabled = event.target.checked,
                map = mapRef.current;
              terrainEnabled.current = enabled;
              setTerrain(enabled);
              if (map)
                configureTerrainRef.current(enabled, exaggerationRef.current);
            }}
          />
          3D terrain
        </label>
        <label>
          Relief
          <select
            aria-label="Terrain exaggeration"
            value={exaggeration}
            disabled={!ready || !terrain || status !== 'Ready'}
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
                {factor.toFixed(1)}×
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="map-status" aria-live="polite">
        {message}
      </div>
    </div>
  );
}
