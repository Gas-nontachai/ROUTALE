import { useEffect, useRef, useState } from 'react';
import {
  ChartNoAxesCombined,
  LoaderCircle,
  LockKeyhole,
  Play,
  Upload,
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

  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(false);

  const isLoading = status === 'loading';

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
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  async function importFile(file: File) {
    if (workerRef.current || useGpxStore.getState().status === 'loading')
      return;
    const id = ++requestIdRef.current;
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

  return (
    <section
      aria-labelledby="import-title"
      aria-busy={isLoading}
      onDragOver={(event) => {
        event.preventDefault();
        if (!isLoading) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!isLoading && event.dataTransfer.files[0])
          void importFile(event.dataTransfer.files[0]);
      }}
      className={`h-full overflow-y-auto overscroll-contain ${dragging ? 'bg-accent outline-2 outline-dashed outline-primary -outline-offset-4' : ''}`}
    >
      <div className="mx-auto grid min-h-full max-w-[1300px] items-center gap-8 px-3 py-8 sm:px-6 sm:py-12 lg:grid-cols-2 lg:gap-12 lg:py-16">
        <div className="min-w-0">
          <h1
            id="import-title"
            className="text-[clamp(2.5rem,5.2vw,4.5rem)] font-bold leading-[1.12] tracking-tight"
          >
            YOUR ROUTE.
            <br />
            <span className="text-primary">YOUR STORY.</span>
          </h1>
          <p className="mt-7 text-lg text-muted">
            Relive your route. Discover more.
          </p>
          <Button
            variant="energy"
            size="xl"
            disabled={isLoading}
            className="mt-8 sm:mt-12"
            onClick={() => inputRef.current?.click()}
          >
            {isLoading ? (
              <LoaderCircle
                size={20}
                className="animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Upload size={20} aria-hidden="true" />
            )}
            {isLoading ? 'Importing…' : 'Import GPX'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".gpx,application/gpx+xml"
            aria-label="Choose GPX file"
            className="sr-only"
            tabIndex={-1}
            disabled={isLoading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
              event.target.value = '';
            }}
          />
          <p
            role="status"
            aria-live="polite"
            className="mt-3 text-sm text-muted"
          >
            {isLoading
              ? importStage
              : dragging
                ? 'Drop to import'
                : 'or drop a GPX here'}
          </p>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-md border border-danger/30 bg-danger-surface p-3 text-sm text-danger"
            >
              {error}
            </p>
          )}
          <p className="mt-7 flex max-w-md items-start gap-2 text-xs leading-relaxed text-muted">
            <LockKeyhole
              size={15}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <span>
              GPX stays on your device. Maps request the area you view.
            </span>
          </p>
        </div>
        <div className="min-w-0 pb-4">
          <div className="overflow-hidden" aria-hidden="true">
            <img
              src="/assets/routale/route.svg"
              width="540"
              height="300"
              alt=""
              className="block h-auto max-w-full"
            />
          </div>
          <ol
            aria-label="Your route to discovery"
            className="mt-4 flex flex-wrap justify-between gap-3 text-xs font-semibold tracking-wide sm:mt-12 sm:text-sm"
          >
            <li className="flex items-center gap-2 text-primary">
              <Upload size={16} aria-hidden="true" /> IMPORT
            </li>
            <li className="flex items-center gap-2 text-foreground">
              <Play size={16} aria-hidden="true" /> RELIVE
            </li>
            <li className="flex items-center gap-2 text-discovery">
              <ChartNoAxesCombined size={16} aria-hidden="true" /> EXPLORE
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}
