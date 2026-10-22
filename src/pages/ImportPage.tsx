import { useEffect, useRef, useState } from 'react';
import {
  LoaderCircle,
  LockKeyhole,
  Map,
  Play,
  Trees,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import type { Activity, World } from '../lib/route';
import { useGpxStore, useWorldStore, useSimulationStore } from '../stores';

type ImportPageProps = { onPreview: () => void };
type WorkerResponse = {
  activity?: Activity;
  world?: World;
  error?: string;
  stage?: string;
};

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const IMPORT_TIMEOUT = 30_000;

export function ImportPage({ onPreview }: ImportPageProps) {
  const { status, error, set } = useGpxStore();
  const { setWorld } = useWorldStore();
  const simulation = useSimulationStore();
  const [importStage, setImportStage] = useState('Reading your trail…');
  const [dragging, setDragging] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const demoRequestRef = useRef(0);
  const mountedRef = useRef(false);

  const isLoading = status === 'loading' || demoLoading;

  function clearWorker() {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    workerRef.current?.terminate();
    workerRef.current = null;
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      demoRequestRef.current += 1;
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  async function importFile(file: File) {
    const id = ++requestIdRef.current;
    ++demoRequestRef.current;
    setDemoLoading(false);
    clearWorker();
    set({ error: '', status: 'loading', activity: null, originalFile: file });
    setImportStage('Reading and validating GPX…');

    if (!/\.gpx$/i.test(file.name)) {
      set({ status: 'error', error: 'Please choose a valid .gpx file.' });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      set({ status: 'error', error: 'Choose a GPX file smaller than 25 MB.' });
      return;
    }

    try {
      const xml = await file.text();
      if (!mountedRef.current || id !== requestIdRef.current) return;

      const worker = new Worker(
        new URL('../lib/gpx.worker.ts', import.meta.url),
        {
          type: 'module',
        },
      );
      workerRef.current = worker;
      timeoutRef.current = window.setTimeout(() => {
        if (!mountedRef.current || id !== requestIdRef.current) return;
        clearWorker();
        set({
          status: 'error',
          error: 'Processing took too long. Try a smaller GPX file.',
        });
      }, IMPORT_TIMEOUT);

      worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
        if (!mountedRef.current || id !== requestIdRef.current) return;
        if (data.stage) {
          setImportStage(data.stage);
          return;
        }
        clearWorker();
        if (data.error || !data.activity || !data.world) {
          set({
            status: 'error',
            error: data.error ?? 'Invalid GPX processing result.',
          });
          return;
        }

        // Store the new route first, then open Preview in Ready state.
        setWorld(data.world);
        set({ activity: data.activity, status: 'ready', error: '' });
        simulation.restart();
        onPreview();
      };
      worker.onerror = () => {
        if (!mountedRef.current || id !== requestIdRef.current) return;
        clearWorker();
        set({ status: 'error', error: 'Could not process this GPX file.' });
      };
      worker.postMessage({ xml, filename: file.name });
    } catch {
      if (!mountedRef.current || id !== requestIdRef.current) return;
      clearWorker();
      set({
        status: 'error',
        error: 'This file could not be read. Please try again.',
      });
    }
  }

  async function loadDemo(smart = false) {
    if (isLoading) return;
    const demoId = ++demoRequestRef.current;
    setDemoLoading(true);
    const name = smart ? 'Smart_Route.gpx' : 'Lunch_Hike.gpx';
    try {
      const response = await fetch(`/${name}`);
      if (!response.ok) throw new Error('Sample unavailable');
      const xml = await response.text();
      if (!mountedRef.current || demoId !== demoRequestRef.current) return;
      await importFile(new File([xml], name, { type: 'application/gpx+xml' }));
    } catch {
      if (!mountedRef.current || demoId !== demoRequestRef.current) return;
      set({
        status: 'error',
        error: 'The sample could not be loaded. Try your own GPX.',
      });
    } finally {
      if (mountedRef.current && demoId === demoRequestRef.current)
        setDemoLoading(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto overscroll-contain py-4 lg:overflow-hidden lg:py-3">
      <div className="flex min-h-0 w-full flex-1 items-center justify-center py-3 sm:py-5">
        <section
          aria-labelledby="import-title"
          className="w-full max-w-[760px] rounded-xl border border-[#D7DFC9] bg-[#F9FAF5] p-4 shadow-sm sm:p-6 lg:max-h-full lg:overflow-y-auto xl:p-7"
        >
          <div className="mb-3 flex items-center gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center border border-[#C9D5BE] text-[10px] font-bold text-[#7B9675]">
              01
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#87957D]">
              Every adventure starts somewhere
            </span>
          </div>

          <div className="mb-4">
            <h1
              id="import-title"
              className="text-xl font-extrabold tracking-tight text-[#193D30] sm:text-2xl"
            >
              Bring your trail.
            </h1>
            <p className="mt-1 text-sm text-[#899483]">
              A morning run, a mountain hike, a walk to remember.
            </p>
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              if (!isLoading) setDragging(true);
            }}
            onDragLeave={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null,
                )
              )
                setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (isLoading) return;
              const file = event.dataTransfer.files[0];
              if (file) void importFile(file);
            }}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-7 text-center transition-colors sm:py-9 ${dragging ? 'border-[#527C4C] bg-[#E5EFD9]' : 'border-[#CEDAC2] bg-[#F4F7EE]'}`}
          >
            <div className="mb-3 flex size-12 items-center justify-center rounded-lg bg-[#E5EDD9] text-[#6E956D]">
              {isLoading ? (
                <LoaderCircle size={25} className="animate-spin" />
              ) : (
                <Upload size={25} />
              )}
            </div>
            <strong className="text-sm font-bold text-[#294B3B]">
              {isLoading
                ? demoLoading
                  ? 'Loading sample trail…'
                  : importStage
                : 'Drop your GPX file here'}
            </strong>
            <p className="mt-1 text-xs text-[#899A85]">
              {isLoading
                ? 'Preparing your 3D adventure…'
                : 'Your route will open automatically after import'}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={() => inputRef.current?.click()}
              className="mt-4 h-9 rounded-md border-[#B6CAB0] bg-white px-4 text-[11px] text-[#456B4C] shadow-none hover:bg-[#E7EFDF]"
            >
              <Upload size={15} /> Choose GPX file
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".gpx,application/gpx+xml"
              aria-label="Choose GPX file"
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importFile(file);
                event.target.value = '';
              }}
            />
            <span className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9AA991]">
              .GPX files
            </span>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}
          <div className="mt-4 flex items-start justify-center gap-2 border-t border-[#DFE6D7] pt-3 text-[11px] leading-relaxed text-[#98A18E]">
            <LockKeyhole size={13} className="mt-0.5 shrink-0" />
            <span>
              GPX stays local. Map providers receive requests for the area you
              view.
            </span>
          </div>
        </section>
      </div>

      <div className="mx-auto hidden w-full max-w-[1100px] shrink-0 grid-cols-3 gap-4 border-t border-[#DEE5D5] pt-4 xl:grid [@media(max-height:850px)]:hidden">
        {[
          {
            icon: Map,
            title: 'Your route, mapped',
            description: 'Every segment stays true to the GPX.',
          },
          {
            icon: Trees,
            title: 'Real terrain',
            description: 'Mapterhorn elevation on OpenFreeMap.',
          },
          {
            icon: Play,
            title: 'Follow the journey',
            description: 'Watch the route with a steady camera.',
          },
        ].map(({ icon: Icon, title, description }) => (
          <div key={title} className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#EAF0E0] text-[#62845C]">
              <Icon size={19} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-bold text-[#294B3B]">{title}</h2>
              <p className="mt-0.5 text-xs text-[#8C9885]">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
