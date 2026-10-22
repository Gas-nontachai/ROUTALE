import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { routeCoordinates } from '../lib/map';
import {
  applyMapStyle,
  satelliteSource,
  type BaseLayer,
  type MapStyle,
} from '../lib/mapStyles';
import type { World } from '../lib/route';
import { useMapStyleStore } from '../stores';

// Keep this consistent with the default style used by RouteMap.
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
maplibregl.setWorkerUrl(workerUrl);

export function SummaryMap({ world }: { world: World }) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [error, setError] = useState('');
  const coordinates = useMemo(() => routeCoordinates(world), [world]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !coordinates.some((segment) => segment.length >= 2)) return;
    let disposed = false;
    const map = new maplibregl.Map({
      container: element,
      style: MAP_STYLE,
      center: coordinates[0][0],
      zoom: 11,
      interactive: false,
      fadeDuration: 0,
      attributionControl: false,
    });
    mapRef.current = map;
    const bounds = new maplibregl.LngLatBounds(
      coordinates[0][0],
      coordinates[0][0],
    );
    coordinates.forEach((segment) =>
      segment.forEach((point) => bounds.extend(point)),
    );
    const fitRoute = () =>
      map.fitBounds(bounds, { padding: 54, duration: 0, maxZoom: 15 });
    let routeReady = false;
    map.on('style.load', () => {
      if (disposed) return;
      const baseLayers: BaseLayer[] = map.getStyle().layers.map((layer) => ({
        id: layer.id,
        type: layer.type,
        visibility: layer.layout?.visibility === 'none' ? 'none' : 'visible',
      }));
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
      let selectedStyle: MapStyle = useMapStyleStore.getState().style;
      const selectStyle = (style: MapStyle) => {
        selectedStyle = style;
        if (style === 'default' || map.isSourceLoaded('satellite-imagery'))
          applyMapStyle(map, style, baseLayers);
        else
          map.setLayoutProperty('satellite-imagery', 'visibility', 'visible');
      };
      selectStyle(selectedStyle);
      const unsubscribe = useMapStyleStore.subscribe((state) => {
        if (!disposed) selectStyle(state.style);
      });
      map.once('remove', unsubscribe);
      map.on('sourcedata', (event) => {
        if (event.sourceId === 'satellite-imagery' && event.isSourceLoaded) {
          applyMapStyle(map, selectedStyle, baseLayers);
          if (!disposed) setError('');
        }
      });
      map.addSource('summary-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'MultiLineString', coordinates },
        },
      });
      map.addLayer({
        id: 'summary-route-line',
        type: 'line',
        source: 'summary-route',
        paint: {
          'line-color': '#26764B',
          'line-width': 5,
          'line-opacity': 0.95,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });
      routeReady = true;
      fitRoute();
    });
    map.on('error', () => {
      if (!disposed) setError('Map tiles could not be loaded.');
    });
    map.on('sourcedata', (event) => {
      if (
        !disposed &&
        event.isSourceLoaded &&
        (useMapStyleStore.getState().style === 'default'
          ? event.sourceId !== 'satellite-imagery'
          : event.sourceId === 'satellite-imagery')
      )
        setError('');
    });
    const observer = new ResizeObserver(() => {
      if (!element.clientWidth || !element.clientHeight) return;
      map.resize();
      if (routeReady) fitRoute();
    });
    observer.observe(element);
    return () => {
      disposed = true;
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [coordinates]);

  return (
    <div className="flex h-full min-h-[240px] w-full flex-col gap-1">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-surface-muted">
        <div
          ref={elementRef}
          className="absolute inset-0"
          style={{ position: 'absolute', inset: 0 }}
          aria-label="Full journey route map"
          role="img"
        />
        {!coordinates.some((segment) => segment.length >= 2) && (
          <div className="absolute inset-0 grid place-items-center px-5 text-center text-sm text-muted">
            Route coordinates unavailable.
          </div>
        )}
        {error && (
          <div className="absolute left-3 top-3 rounded bg-surface p-2 text-xs">
            {error}
          </div>
        )}
      </div>
      <p className="text-right text-xs text-muted">
        <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">
          OpenFreeMap
        </a>
        {' · '}
        <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">
          © OpenMapTiles
        </a>
        {' · '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap contributors
        </a>
      </p>
    </div>
  );
}
