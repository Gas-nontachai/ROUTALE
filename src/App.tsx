import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, Check, ChevronRight, Compass, FileCheck2, Footprints, Leaf, LoaderCircle, LockKeyhole, Map, Mountain, Pause, Play, RotateCcw, Sparkles, Trees, Upload, X } from 'lucide-react';
import { Button } from './components/ui/button';
import { Forest } from './renderer/PixelWorld';
import { createWorld, type Activity, type World } from './lib/route';
import { useGpxStore, useWorldStore, useSimulationStore } from './stores';
const demoSegments = [Array.from({ length: 100 }, (_, i) => ({ lat: 18.795 + i / 99 * .022, lon: 98.97 + Math.sin(i / 99 * Math.PI * 2) * .006 + Math.sin(i / 99 * Math.PI * 6) * .0013 }))];
const previewWorld = createWorld({ segments: demoSegments, distance: 4000, count: 100, name: 'Preview', ascent: 140, seed: 82411 });
const km = (m: number) => `${(m / 1000).toFixed(2)} km`;
export default function App() {
  const { activity, status, error, set } = useGpxStore();
  const { world, setWorld } = useWorldStore();
  const simulation = useSimulationStore();
  const [screen, setScreen] = useState<'import' | 'world'>('import');
  useEffect(() => { window.scrollTo(0, 0); }, [screen]);
  const [dragging, setDragging] = useState(false);
  const [filename, setFilename] = useState('');
  const [help, setHelp] = useState(false);
  const helpDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (help) helpDialog.current?.showModal(); }, [help]);
  const input = useRef<HTMLInputElement>(null), worker = useRef<Worker | null>(null), requestId = useRef(0);
  useEffect(() => () => { worker.current?.terminate(); requestId.current++; }, []);
  async function importFile(file: File) {
    const id = ++requestId.current;
    worker.current?.terminate();
    set({ error: '', status: 'loading', activity: null }); setFilename(file.name);
    if (!/\.gpx$/i.test(file.name)) { set({ status: 'error', error: 'Please choose a .gpx file exported from your activity app.' }); return; }
    if (file.size > 25 * 1024 * 1024) { set({ status: 'error', error: 'Choose a GPX file smaller than 25 MB.' }); return; }
    try {
      const xml = await file.text();
      if (id !== requestId.current) return;
      const current = new Worker(new URL('./lib/gpx.worker.ts', import.meta.url), { type: 'module' }); worker.current = current;
      const timeout = window.setTimeout(() => { current.terminate(); if (id === requestId.current) set({ status: 'error', error: 'Processing took too long. Please split this route into a smaller GPX file.' }); }, 30000);
      current.onmessage = ({ data }: MessageEvent<{ activity: Activity; world: World; error?: string }>) => {
        window.clearTimeout(timeout); current.terminate();
        if (id !== requestId.current) return;
        if (data.error) set({ status: 'error', error: data.error });
        else { set({ activity: data.activity, status: 'ready', error: '' }); setWorld(data.world); simulation.restart(); }
      };
      current.onerror = () => { window.clearTimeout(timeout); current.terminate(); if (id === requestId.current) set({ status: 'error', error: 'Could not process this file. Try a smaller GPX export.' }); };
      current.postMessage({ xml, filename: file.name });
    } catch { if (id === requestId.current) set({ status: 'error', error: 'This file could not be read. Please try again.' }); }
  }
  async function loadDemo() {
    try { const response = await fetch('/Lunch_Hike.gpx'); if (!response.ok) throw new Error(); await importFile(new File([await response.text()], 'Lunch_Hike.gpx', { type: 'application/gpx+xml' })); }
    catch { set({ status: 'error', error: 'The sample could not be loaded. Try importing your own GPX.' }); }
  }
  const progress = world ? Math.min(100, simulation.distance / world.distance * 100) : 0;
  function startAdventure() { if (!world || status !== 'ready') return; simulation.restart(); setScreen('world'); }
  return <div className="app-shell">
    <header className="site-header"><a className="brand" href="/" aria-label="Trailbound home"><span className="brand-icon"><Trees size={25}/></span><span>TRAILBOUND<span className="brand-sub">A LITTLE ADVENTURE, FROM YOUR OWN.</span></span></a><div className="header-right"><span className="edition"><span/> GPX PIXEL ADVENTURE</span><button className="text-button" onClick={() => setHelp(true)}>How it works <span>↗</span></button></div></header>
    <main>
      {screen === 'import' ? <>
        <div className="page-heading"><div className="eyebrow"><span/> REAL TRAILS. LITTLE WORLDS.</div><h1>Your journey.<br/>A whole new <em>world.</em></h1><p>Turn the trail you took into a pixel adventure.<br className="desktop-break"/> Bring a GPX file. We’ll bring the forest.</p></div>
        <div className="adventure-layout">
          <section className="import-panel" aria-labelledby="import-title">
            <div className="panel-top"><span className="step-number">01</span><span>EVERY ADVENTURE STARTS SOMEWHERE</span></div>
            <h2 id="import-title">Bring your trail.</h2><p className="muted">A morning run, a mountain hike, a walk to remember.</p>
            <div className={`dropzone ${dragging ? 'dragging' : ''} ${status === 'ready' ? 'has-file' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file) void importFile(file); }}>
              <div className="upload-icon">{status === 'loading' ? <LoaderCircle className="spin" size={29}/> : status === 'ready' ? <FileCheck2 size={29}/> : <Upload size={29}/>}</div>
              <strong>{status === 'loading' ? 'Reading your trail…' : status === 'ready' ? 'Your trail is packed.' : 'Drop your GPX file here'}</strong>
              <span className="drop-detail">{status === 'ready' ? filename : 'or choose one from your device'}</span>
              <Button variant="outline" onClick={() => input.current?.click()} disabled={status === 'loading'}><Upload size={15}/>{status === 'ready' ? 'Choose another file' : 'Choose GPX file'}</Button>
              <input ref={input} className="sr-only" tabIndex={-1} aria-label="Choose GPX file" type="file" accept=".gpx,application/gpx+xml" onChange={e => { const file = e.target.files?.[0]; if (file) void importFile(file); e.target.value = ''; }}/>
              <small>.GPX FILES · UP TO 25 MB</small>
            </div>
            <div aria-live="polite">{error && <p className="error" role="alert">{error}</p>}{activity && status === 'ready' && <div className="activity-summary"><div><Check size={16}/><strong>{activity.name}</strong></div><p>{activity.count.toLocaleString()} GPS points <span>·</span> {km(activity.distance)} <span>·</span> {activity.segments.length} segment{activity.segments.length !== 1 ? 's' : ''}</p></div>}</div>
            <Button className="generate-button" disabled={status !== 'ready'} onClick={startAdventure}><Sparkles size={17}/> Generate my world <ArrowRight size={18}/></Button>
            <div className="sample-line">Just looking around? <button onClick={() => void loadDemo()} disabled={status === 'loading'}>Try a sample trail <ArrowRight size={13}/></button></div>
            <div className="privacy"><LockKeyhole size={14}/><span>Your trails stay yours. Files never leave your browser.</span></div>
          </section>
          <section className="preview-panel" aria-label="Pixel world preview"><div className="preview-title"><span><span className="live-dot"/> A LITTLE PREVIEW OF WHAT’S AHEAD</span><span>FOREST / 01</span></div><div className="preview-scene"><Forest world={previewWorld} preview/><div className="scene-grain"/><div className="world-tag"><Trees size={15}/> THE MOSSWOOD FOREST</div><div className="floating-label"><span className="pixel-spark">✦</span> A trail worth reliving.</div><div className="scene-coordinates">18°47′ N &nbsp; 98°58′ E</div></div><div className="preview-caption"><span className="caption-icon"><Footprints size={21}/></span><div><strong>Same footsteps. Different magic.</strong><p>Your real route, reimagined in a living pixel forest.</p></div><span className="little-star">✧</span></div></section>
        </div>
        <div className="how-strip"><div><span className="feature-icon"><Map size={20}/></span><div><strong>Your route, reimagined</strong><p>Built from your actual GPS coordinates.</p></div></div><div><span className="feature-icon"><Trees size={21}/></span><div><strong>A forest of your own</strong><p>A unique world, grown around your trail.</p></div></div><div><span className="feature-icon"><Play size={19}/></span><div><strong>Walk it all over again</strong><p>Press play. Let your little adventurer wander.</p></div></div></div>
      </> : world && activity && <div className="simulation-page">
        <div className="simulation-heading"><div><button className="back-link" onClick={() => { simulation.setStatus(simulation.status === 'Playing' ? 'Paused' : simulation.status); setScreen('import'); }}><ArrowLeft size={14}/> Back to your trail</button><h1>{activity.name}</h1><p>{km(activity.distance)} <span>·</span> {activity.count.toLocaleString()} GPS points <span>·</span> Forest adventure</p></div><div className={`status-badge ${simulation.status.toLowerCase()}`}><span/>{simulation.status}</div></div>
        <div className="simulation-layout"><section className="world-panel"><div className="world-toolbar"><span><Trees size={15}/> MOSSWOOD FOREST</span><span><Compass size={14}/> N ↑</span></div><div className="simulation-canvas"><Forest world={world}/><div className="camera-label"><span/> FOLLOW CAMERA</div>{simulation.status === 'Ready' && <div className="ready-note"><Sparkles size={16}/> Your next little adventure is ready.</div>}{simulation.status === 'Completed' && <div className="completed-note"><span>✦</span><h2>Trail conquered.</h2><p>Every step, a little bit of magic.</p><Button onClick={simulation.restart}><RotateCcw size={15}/> Walk it again</Button></div>}</div></section>
        <aside className="journey-panel"><div className="eyebrow">YOUR ADVENTURE</div><h2>One step at a time.</h2><div className="mini-map"><svg viewBox={`0 0 ${world.width} ${world.height}`} aria-label="Overview of your full route" role="img">{world.segments.map((s, i) => <polyline key={i} points={s.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#b6c88d" strokeWidth="17" strokeLinejoin="round"/>)}{world.spots.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={i === 0 || i === 6 ? 25 : 13} fill={i <= simulation.waypoint ? '#ecc576' : '#6b8556'}/> )}</svg><span>YOUR TRAIL MAP</span></div><div className="journey-stat"><span><Footprints size={16}/> Distance traveled</span><strong>{km(simulation.distance)} <small>/ {km(world.distance)}</small></strong></div><div className="journey-stat"><span><Mountain size={16}/> Elevation gain</span><strong>{Math.round(activity.ascent)} <small>m</small></strong></div><div className="waypoint-list">{world.spots.map((p, i) => <div key={i} className={i <= simulation.waypoint ? 'reached' : ''}><span>{i <= simulation.waypoint ? <Check size={11}/> : i === 6 ? '⚑' : '·'}</span><span>{p.label}</span>{i === simulation.waypoint && <small>{simulation.status === 'Completed' ? 'ARRIVED' : 'HERE'}</small>}</div>)}</div><p className="world-note"><Leaf size={14}/> A forest imagined from your route.<br/>Scenery does not represent real terrain.</p></aside></div>
        <section className="playback-panel" aria-label="Playback controls"><Button size="icon" variant="outline" aria-label="Restart adventure" title="Restart adventure" onClick={simulation.restart}><RotateCcw size={18}/></Button><Button className="play-button" disabled={simulation.status === 'Completed'} onClick={() => simulation.setStatus(simulation.status === 'Playing' ? 'Paused' : 'Playing')}>{simulation.status === 'Playing' ? <Pause size={17}/> : <Play size={17}/>} {simulation.status === 'Playing' ? 'Pause' : simulation.status === 'Paused' ? 'Resume' : 'Play'}</Button><div className="progress-area"><div><span>{simulation.status === 'Completed' ? 'You made it. Welcome to the finish.' : 'A little closer to the finish.'}</span><strong>{progress.toFixed(0)}%</strong></div><progress aria-label="Route progress" value={progress} max="100"/></div><div className="playback-end"><span>⚑</span><small>THE FINISH<br/><strong>{km(world.distance)}</strong></small></div></section>
      </div>}
    </main>
    <footer><span><Trees size={14}/> MADE FOR THE WANDERERS.</span><span>A little less scrolling. A little more exploring. <Leaf size={13}/></span><span>FRONTEND ONLY <span className="footer-dot">◆</span> MVP 01</span></footer>
    {help && <dialog ref={helpDialog} className="modal-backdrop" aria-labelledby="help-title" onClose={() => setHelp(false)} onClick={e => { if (e.target === e.currentTarget) setHelp(false); }}><section className="help-dialog"><Button autoFocus variant="ghost" size="icon" className="close-dialog" onClick={() => setHelp(false)} aria-label="Close instructions"><X size={20}/></Button><div className="eyebrow">YOUR NEXT LITTLE ADVENTURE</div><h2 id="help-title">From trail to tiny world.</h2><p>Export a GPX file from your activity app, then:</p><ol><li><Upload size={18}/><span><strong>Bring your trail</strong>Choose or drop a GPX file. Everything stays in this browser.</span></li><li><Trees size={18}/><span><strong>Grow your world</strong>Generate a seeded forest around your real GPS route.</span></li><li><Play size={18}/><span><strong>Relive the journey</strong>Play, pause, or restart. Your adventurer follows the full trail.</span></li></ol><a className="sample-download" href="/Lunch_Hike.gpx" download><ArrowDownToLine size={15}/> Download sample GPX <ChevronRight size={14}/></a></section></dialog>}
  </div>;
}
