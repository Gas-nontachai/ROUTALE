import { useEffect, useRef, useState } from 'react';
import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Text,
  type Texture,
} from 'pixi.js';
import { animationAt, random, type Point, type World } from '../lib/route';
import {
  heightConfig,
  isometric,
  terrainHeight,
  type Geography,
} from '../lib/geography';
import { useSimulationStore } from '../stores';
function rect(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
) {
  g.rect(Math.round(x), Math.round(y), w, h).fill(color);
}
function polygon(
  g: Graphics,
  points: { x: number; y: number }[],
  color: number,
) {
  g.poly(points.flatMap((p) => [p.x, p.y])).fill(color);
}
export function Forest({
  world,
  preview = false,
  geography = null,
  exaggeration = 1,
}: {
  world: World;
  preview?: boolean;
  geography?: Geography | null;
  exaggeration?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let disposed = false,
      ready = false;
    setError('');
    setLoading(true);
    const app = new Application(),
      element = host.current!;
    let observer: ResizeObserver | undefined;
    async function init() {
      await app.init({
        resizeTo: element,
        background: 0x739454,
        antialias: false,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        preference: 'webgl',
      });
      ready = true;
      if (disposed) {
        app.destroy(true, { children: true });
        return;
      }
      element.appendChild(app.canvas);
      const names = ['pine', 'cottage', 'landmark', 'rock'] as const;
      const textures = await Assets.load<Texture>(
        names.map((name) => `/assets/${name}.svg`),
      );
      await document.fonts.load('11px iannnnnAMD').catch(() => undefined);
      if (disposed) return;
      for (const texture of Object.values(textures))
        texture.source.scaleMode = 'nearest';
      const config = heightConfig(world, geography);
      const height = (x: number, y: number) =>
        terrainHeight(world, geography, x, y);
      const iso = (p: Point) =>
        isometric(
          world,
          p,
          p.elevation ?? height(p.x, p.y),
          config,
          exaggeration,
        );
      const scene = new Container({ sortableChildren: true });
      app.stage.addChild(scene);
      const sceneWidth = (world.width + world.height) * 0.75 + 240,
        sceneHeight = (world.width + world.height) * 0.4 + 650;
      const ground = new Graphics();
      scene.addChild(ground);
      // Layered diamond tiles use measured DEM heights, or explicitly labeled GPX-derived estimates.
      const tiles = 30,
        tileW = world.width / tiles,
        tileH = world.height / tiles;
      const color = (level: number) =>
        level > 0.7 ? 0x91a56a : level > 0.35 ? 0x7e9957 : 0x6f8d50;
      for (let row = 0; row < tiles; row++)
        for (let col = 0; col < tiles; col++) {
          const x = col * tileW,
            y = row * tileH;
          const corners = [
            [x, y],
            [x + tileW, y],
            [x + tileW, y + tileH],
            [x, y + tileH],
          ].map(([x, y]) => iso({ x, y, distance: 0 }));
          const level =
            (((height(x, y) ?? config.min) - config.min) * config.scale) / 130;
          const depth = 8;
          polygon(
            ground,
            [
              corners[1],
              corners[2],
              { x: corners[2].x, y: corners[2].y + depth },
              { x: corners[1].x, y: corners[1].y + depth },
            ],
            0x526b40,
          );
          polygon(
            ground,
            [
              corners[2],
              corners[3],
              { x: corners[3].x, y: corners[3].y + depth },
              { x: corners[2].x, y: corners[2].y + depth },
            ],
            0x607947,
          );
          polygon(ground, corners, color(level));
        }
      const rng = random(world.seed);
      for (let i = 0; i < 2600; i++) {
        const p = iso({
          x: rng() * world.width,
          y: rng() * world.height,
          distance: 0,
        });
        rect(
          ground,
          p.x,
          p.y,
          3 + Math.floor(rng() * 4),
          2,
          rng() > 0.5 ? 0x9ab272 : 0x62834b,
        );
      }
      const mapLayer = new Graphics();
      mapLayer.zIndex = 2;
      scene.addChild(mapLayer);
      for (const feature of geography?.features || []) {
        const points = feature.points.map(iso);
        if (feature.kind === 'building' || feature.kind === 'landmark')
          continue;
        if (
          feature.closed &&
          ['forest', 'grass', 'water'].includes(feature.kind)
        )
          polygon(
            mapLayer,
            points,
            feature.kind === 'water'
              ? 0x638c99
              : feature.kind === 'forest'
                ? 0x527647
                : 0x8b9e5e,
          );
        else if (points.length > 1) {
          mapLayer.moveTo(points[0].x, points[0].y);
          for (const p of points.slice(1)) mapLayer.lineTo(p.x, p.y);
          mapLayer.stroke({
            width:
              feature.kind === 'road' ? 15 : feature.kind === 'water' ? 11 : 6,
            color:
              feature.kind === 'road'
                ? 0xa5a18b
                : feature.kind === 'water'
                  ? 0x638c99
                  : 0xbaa879,
            join: 'round',
          });
        }
      }
      const occupied = new Set<string>();
      const path = new Graphics();
      path.zIndex = 3;
      scene.addChild(path);
      for (const segment of world.segments) {
        for (let i = 1; i < segment.length; i++) {
          const a = segment[i - 1],
            b = segment[i],
            steps = Math.max(
              1,
              Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 12),
            );
          for (let j = 0; j <= steps; j++) {
            const x = a.x + ((b.x - a.x) * j) / steps,
              y = a.y + ((b.y - a.y) * j) / steps;
            for (let dx = -3; dx <= 3; dx++)
              for (let dy = -3; dy <= 3; dy++)
                occupied.add(
                  `${Math.floor(x / 20) + dx},${Math.floor(y / 20) + dy}`,
                );
          }
        }
        for (const [width, color] of [
          [24, 0x5b7445],
          [19, 0xad965f],
          [13, 0xd9c68d],
        ]) {
          const first = iso(segment[0]);
          path.moveTo(first.x, first.y);
          for (const p of segment.slice(1)) {
            const q = iso(p);
            path.lineTo(q.x, q.y);
          }
          path.stroke({ width, color, cap: 'square', join: 'round' });
        }
      }
      const sprite = (name: (typeof names)[number], p: Point, scale = 1) => {
        const object = new Sprite(textures[`/assets/${name}.svg`]);
        object.anchor.set(0.5, 0.94);
        object.scale.set(scale);
        object.position.copyFrom(iso(p));
        object.zIndex = (p.x + p.y) * 0.4 + 100;
        scene.addChild(object);
        return object;
      };
      function inside(p: Point, polygon: Point[]) {
        let value = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          const a = polygon[i],
            b = polygon[j];
          if (
            a.y > p.y !== b.y > p.y &&
            p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
          )
            value = !value;
        }
        return value;
      }
      const mappedAreas = (geography?.features || []).filter(
        (f) =>
          f.closed && ['forest', 'grass', 'water', 'building'].includes(f.kind),
      );
      for (let i = 0; i < 650; i++) {
        const p = {
          x: 25 + rng() * (world.width - 50),
          y: 25 + rng() * (world.height - 50),
          distance: 0,
        };
        if (occupied.has(`${Math.floor(p.x / 20)},${Math.floor(p.y / 20)}`))
          continue;
        const area = mappedAreas.find((f) => inside(p, f.points));
        if (area && ['water', 'building', 'grass'].includes(area.kind))
          continue;
        // With real map data, trees only mark mapped forest; fallback decorations are labeled procedural.
        if (geography?.features.length && area?.kind !== 'forest') {
          if (rng() > 0.96) sprite('rock', p);
          continue;
        }
        sprite(rng() > 0.12 ? 'pine' : 'rock', p, 0.8 + rng() * 0.35);
      }
      for (const feature of geography?.features || []) {
        if (feature.kind !== 'building' && feature.kind !== 'landmark')
          continue;
        const p = {
          x:
            feature.points.reduce((n, p) => n + p.x, 0) / feature.points.length,
          y:
            feature.points.reduce((n, p) => n + p.y, 0) / feature.points.length,
          distance: 0,
        };
        if (p.x < 0 || p.x > world.width || p.y < 0 || p.y > world.height)
          continue;
        if (
          feature.kind === 'building' &&
          occupied.has(`${Math.floor(p.x / 20)},${Math.floor(p.y / 20)}`)
        )
          continue;
        const object = sprite(
          feature.kind === 'building' ? 'cottage' : 'landmark',
          p,
          feature.kind === 'building' ? 0.8 : 1,
        );
        object.eventMode = 'static';
        object.cursor = 'help';
        object.on('pointerover', () => {
          element.title = `${feature.name || (feature.kind === 'building' ? 'Building' : 'Landmark')} · OpenStreetMap`;
        });
        object.on('pointerout', () => {
          element.title = '';
        });
      }
      for (const spot of world.spots) {
        const marker = new Graphics(),
          q = iso(spot);
        marker.position.copyFrom(q);
        marker.zIndex = (spot.x + spot.y) * 0.4 + 101;
        scene.addChild(marker);
        if (spot.type === 'start' || spot.type === 'finish') {
          rect(marker, -2, -34, 4, 33, 0x5b4734);
          rect(
            marker,
            2,
            -34,
            21,
            14,
            spot.type === 'start' ? 0xe7bd63 : 0xf4ecd0,
          );
          if (spot.type === 'finish') {
            rect(marker, 2, -34, 7, 7, 0x34553c);
            rect(marker, 9, -27, 7, 7, 0x34553c);
            rect(marker, 16, -34, 7, 7, 0x34553c);
          }
        } else {
          rect(
            marker,
            -9,
            -18,
            18,
            18,
            spot.type === 'rest'
              ? 0x6a875b
              : spot.type === 'loop'
                ? 0xb58e50
                : 0x879592,
          );
          const text = new Text({
            text:
              spot.type === 'rest'
                ? 'z'
                : spot.type === 'loop'
                  ? `${spot.loopCount}×`
                  : '▲',
            style: {
              fontFamily: ['iannnnnAMD', 'monospace'],
              fontSize: 11,
              fill: 0xfff4cf,
            },
          });
          text.anchor.set(0.5);
          text.position.set(0, -9);
          marker.addChild(text);
        }
      }
      const player = new Graphics();
      scene.addChild(player);
      let lastPose = '',
        facing = 'down',
        old = iso(animationAt(world, 0));
      let localElapsed = useSimulationStore.getState().elapsed,
        lastPublished = localElapsed,
        elapsed = 0,
        publishTime = 0,
        resetToken = useSimulationStore.getState().resetToken;
      let cameraX = old.x,
        cameraY = old.y;
      function pose(direction: string, step: number, resting: boolean) {
        player.clear();
        rect(player, -9, -1, 19, 6, 0x5d7146);
        rect(player, -6, -12, 5, 11 + step * 2, 0x443f33);
        rect(player, 2, -12, 5, 13 - step * 2, 0x443f33);
        rect(player, -8, -25, 16, 16, resting ? 0x9d7d48 : 0xc67c3d);
        rect(player, -11, -23, 4, 12, 0xe2b57c);
        rect(player, 8, -23, 4, 12, 0xe2b57c);
        rect(player, -7, -36, 14, 13, 0xf0c58f);
        rect(player, -9, -39, 18, 7, 0x516c43);
        rect(player, -12, -33, 24, 4, 0x3b5539);
        if (direction === 'up') {
          rect(player, -6, -26, 12, 13, 0x735337);
          rect(player, -3, -24, 6, 7, 0x9c7546);
        } else {
          if (direction !== 'left') rect(player, 3, -29, 2, 2, 0x344333);
          if (direction !== 'right') rect(player, -5, -29, 2, 2, 0x344333);
        }
        if (resting) {
          rect(player, 13, -43 - step * 2, 7, 3, 0xffedb0);
          rect(player, 17, -40 - step * 2, 3, 3, 0xffedb0);
          rect(player, 13, -37 - step * 2, 7, 3, 0xffedb0);
        }
      }
      observer = new ResizeObserver(() => app.resize());
      observer.observe(element);
      setLoading(false);
      app.ticker.add((ticker) => {
        const dt = Math.min(ticker.deltaMS / 1000, 0.1),
          state = useSimulationStore.getState();
        if (
          resetToken !== state.resetToken ||
          (!preview && state.elapsed !== lastPublished)
        ) {
          localElapsed = state.elapsed;
          lastPublished = state.elapsed;
          resetToken = state.resetToken;
        }
        if (!preview && state.status === 'Playing')
          localElapsed = Math.min(
            world.duration,
            localElapsed + dt * state.speed,
          );
        elapsed += dt;
        publishTime += dt;
        const source = animationAt(
            world,
            preview ? world.duration * 0.36 : localElapsed,
          ),
          p = iso(source);
        const resting = source.movement === 'stay';
        if (Math.hypot(p.x - old.x, p.y - old.y) > 0.01)
          facing =
            Math.abs(p.x - old.x) > Math.abs(p.y - old.y)
              ? p.x > old.x
                ? 'right'
                : 'left'
              : p.y > old.y
                ? 'down'
                : 'up';
        const step =
            !preview && state.status === 'Playing'
              ? Math.floor(elapsed * (resting ? 2 : 8)) % 2
              : 0,
          key = `${facing}${step}${resting}`;
        if (key !== lastPose) {
          pose(facing, step, resting);
          lastPose = key;
        }
        player.position.set(Math.round(p.x), Math.round(p.y));
        player.zIndex = (source.x + source.y) * 0.4 + 102;
        old = p;
        if (
          !preview &&
          (publishTime > 0.1 || localElapsed >= world.duration) &&
          state.status === 'Playing'
        ) {
          state.update(
            localElapsed,
            world.duration,
            source.distance,
            world.spots.filter((s) => s.distance <= source.distance).length - 1,
            source.movement,
          );
          lastPublished = localElapsed;
          publishTime = 0;
        }
        const vw = app.screen.width,
          vh = app.screen.height;
        const scale = preview
          ? Math.max(vw / sceneWidth, vh / sceneHeight) * 1.7
          : Math.max(0.85, vw / sceneWidth, vh / sceneHeight);
        scene.scale.set(scale);
        const targetX = preview ? sceneWidth * 0.5 : p.x,
          targetY = preview ? sceneHeight * 0.48 : p.y;
        cameraX += (targetX - cameraX) * (1 - Math.exp(-5 * dt));
        cameraY += (targetY - cameraY) * (1 - Math.exp(-5 * dt));
        scene.position.set(
          Math.round(
            Math.min(
              0,
              Math.max(vw - sceneWidth * scale, vw / 2 - cameraX * scale),
            ),
          ),
          Math.round(
            Math.min(
              0,
              Math.max(vh - sceneHeight * scale, vh / 2 - cameraY * scale),
            ),
          ),
        );
      });
    }
    init().catch(() => {
      if (!disposed) {
        setLoading(false);
        setError(
          'The pixel world could not start. Try reloading in a browser with WebGL enabled.',
        );
      }
    });
    return () => {
      disposed = true;
      observer?.disconnect();
      if (ready) app.destroy(true, { children: true });
    };
  }, [world, preview, geography, exaggeration]);
  return (
    <div
      className="forest-canvas"
      ref={host}
      role="img"
      aria-label={
        preview
          ? 'Preview of a layered pixel forest'
          : 'Isometric pixel terrain with your GPX route, spots, and animated adventurer'
      }
    >
      {loading && !error && (
        <p className="renderer-loading" role="status">
          Growing your 2.5D world…
        </p>
      )}
      {error && (
        <p className="renderer-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
