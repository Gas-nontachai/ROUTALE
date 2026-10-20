import { useEffect, useRef, useState } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import { positionAt, random, type World } from '../lib/route';
import { useSimulationStore } from '../stores';

function rect(g: Graphics, x: number, y: number, w: number, h: number, color: number) { g.rect(Math.round(x), Math.round(y), w, h).fill(color); }
function tree(g: Graphics, x: number, y: number, variant: number) {
  rect(g, x - 15, y + 11, 34, 9, 0x497147); rect(g, x - 4, y - 3, 9, 23, 0x73523c);
  const layers = [[-22, -19, 44, 18], [-18, -34, 36, 21], [-12, -46, 24, 19], [-6, -55, 12, 16]];
  for (const [dx, dy, w, h] of layers) { rect(g, x + dx, y + dy, w, h, variant ? 0x214c3b : 0x2c5940); rect(g, x + dx, y + dy, w - 6, 6, variant ? 0x3c7250 : 0x4b8053); rect(g, x + dx + w - 7, y + dy + 6, 7, h - 6, 0x1e4535); }
}
export function Forest({ world, preview = false }: { world: World; preview?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false, ready = false;
    const app = new Application();
    const element = host.current!;
    let observer: ResizeObserver | undefined;
    async function init() {
      await app.init({ resizeTo: element, background: 0x739454, antialias: false, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true, preference: 'webgl' });
      ready = true;
      if (disposed) { app.destroy(true, { children: true }); return; }
      element.appendChild(app.canvas);
      const scene = new Container(); app.stage.addChild(scene);
      const ground = new Graphics(); scene.addChild(ground);
      rect(ground, 0, 0, world.width, world.height, 0x779759);
      const rng = random(world.seed);
      for (let i = 0; i < 3500; i++) {
        const x = rng() * world.width, y = rng() * world.height;
        rect(ground, x, y, 3 + Math.floor(rng() * 4), 3, rng() > .5 ? 0x87a263 : 0x6b8a4c);
      }
      const occupied = new Set<string>();
      for (const segment of world.segments) {
        for (let i = 1; i < segment.length; i++) {
          const a = segment[i - 1], b = segment[i], steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 12));
          for (let j = 0; j <= steps; j++) {
            const x = a.x + (b.x - a.x) * j / steps, y = a.y + (b.y - a.y) * j / steps;
            for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) occupied.add(`${Math.floor(x / 20) + dx},${Math.floor(y / 20) + dy}`);
          }
        }
        for (const [width, color] of [[34, 0x5c7846], [28, 0xb39a65], [20, 0xd2bd85]]) {
          ground.moveTo(segment[0].x, segment[0].y);
          for (const p of segment.slice(1)) ground.lineTo(p.x, p.y);
          ground.stroke({ width, color, cap: 'square', join: 'round' });
        }
      }
      const decor = new Graphics(); scene.addChild(decor);
      const objects = Array.from({ length: 720 }, () => ({ x: 35 + rng() * (world.width - 70), y: 65 + rng() * (world.height - 100), variant: rng() })).sort((a, b) => a.y - b.y);
      for (const { x, y, variant } of objects) {
        if (occupied.has(`${Math.floor(x / 20)},${Math.floor(y / 20)}`)) continue;
        if (variant > .18) tree(decor, x, y, variant > .6 ? 1 : 0);
        else { rect(decor, x - 10, y, 21, 10, 0x677768); rect(decor, x - 7, y - 6, 15, 10, 0x9ba38a); rect(decor, x - 5, y - 5, 6, 3, 0xb9bba0); }
      }
      for (const [i, p] of world.spots.entries()) {
        if (i > 0 && i < 6) { rect(decor, p.x - 4, p.y - 4, 8, 8, 0xf1dfad); rect(decor, p.x - 2, p.y - 2, 4, 4, 0x8c774e); }
        else { rect(decor, p.x - 2, p.y - 35, 4, 33, 0x5b4734); rect(decor, p.x + 2, p.y - 35, 23, 15, i === 0 ? 0xe7bd63 : 0xe8e6c6); if (i === 6) { rect(decor, p.x + 2, p.y - 35, 7, 7, 0x34553c); rect(decor, p.x + 9, p.y - 28, 7, 8, 0x34553c); rect(decor, p.x + 16, p.y - 35, 9, 7, 0x34553c); } }
      }
      const player = new Graphics(); scene.addChild(player);
      let lastPose = '', facing = 'down', old = positionAt(world, 0), localDistance = useSimulationStore.getState().distance, lastPublished = localDistance, elapsed = 0, publishTime = 0;
      let resetToken = useSimulationStore.getState().resetToken;
      let cameraX = old.x, cameraY = old.y;
      function pose(direction: string, step: number) {
        player.clear(); rect(player, -9, -1, 19, 6, 0x5d7146);
        rect(player, -6, -12, 5, 11 + step * 2, 0x443f33); rect(player, 2, -12, 5, 13 - step * 2, 0x443f33);
        rect(player, -8, -25, 16, 16, 0xc67c3d); rect(player, -11, -23, 4, 12, 0xe2b57c); rect(player, 8, -23, 4, 12, 0xe2b57c);
        rect(player, -7, -36, 14, 13, 0xf0c58f); rect(player, -9, -39, 18, 7, 0x516c43); rect(player, -12, -33, 24, 4, 0x3b5539);
        if (direction === 'up') { rect(player, -6, -26, 12, 13, 0x735337); rect(player, -3, -24, 6, 7, 0x9c7546); }
        else { if (direction !== 'left') rect(player, 3, -29, 2, 2, 0x344333); if (direction !== 'right') rect(player, -5, -29, 2, 2, 0x344333); }
      }
      function resize() { app.resize(); }
      observer = new ResizeObserver(resize); observer.observe(element);
      app.ticker.add(ticker => {
        const dt = Math.min(ticker.deltaMS / 1000, .1), state = useSimulationStore.getState();
        if (resetToken !== state.resetToken) { localDistance = state.distance; lastPublished = state.distance; resetToken = state.resetToken; }
        if (!preview && state.distance !== lastPublished) { localDistance = state.distance; lastPublished = state.distance; }
        if (!preview && state.status === 'Playing') localDistance = Math.min(world.distance, localDistance + dt * state.speed);
        elapsed += dt; publishTime += dt;
        const p = positionAt(world, preview ? world.distance * .36 : localDistance);
        if (Math.hypot(p.x - old.x, p.y - old.y) > .01) facing = Math.abs(p.x - old.x) > Math.abs(p.y - old.y) ? p.x > old.x ? 'right' : 'left' : p.y > old.y ? 'down' : 'up';
        const step = !preview && state.status === 'Playing' ? Math.floor(elapsed * 8) % 2 : 0, key = `${facing}${step}`;
        if (key !== lastPose) { pose(facing, step); lastPose = key; }
        player.position.set(Math.round(p.x), Math.round(p.y)); old = p;
        if (!preview && (publishTime > .1 || localDistance >= world.distance) && state.status === 'Playing') { state.update(localDistance, world.distance); lastPublished = localDistance; publishTime = 0; }
        const vw = app.screen.width, vh = app.screen.height;
        const scale = preview ? Math.max(vw / world.width, vh / world.height) * 1.16 : Math.max(.9, vw / world.width, vh / world.height);
        scene.scale.set(scale);
        const targetX = preview ? world.width * .49 : p.x, targetY = preview ? world.height * .52 : p.y;
        cameraX += (targetX - cameraX) * (1 - Math.exp(-5 * dt)); cameraY += (targetY - cameraY) * (1 - Math.exp(-5 * dt));
        scene.position.set(Math.round(Math.min(0, Math.max(vw - world.width * scale, vw / 2 - cameraX * scale))), Math.round(Math.min(0, Math.max(vh - world.height * scale, vh / 2 - cameraY * scale))));
      });
    }
    init().catch(() => { if (!disposed) setError('The forest renderer could not start. Please try a browser with WebGL enabled.'); });
    return () => { disposed = true; observer?.disconnect(); if (ready) app.destroy(true, { children: true }); };
  }, [world, preview]);
  return <div className="forest-canvas" ref={host} role="img" aria-label={preview ? 'Preview of a pixel forest with a winding trail' : 'Your GPX route in a pixel forest, with an animated adventurer'}>{error && <p className="renderer-error" role="alert">{error}</p>}</div>;
}
