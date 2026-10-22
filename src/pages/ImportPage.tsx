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

  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
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
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto overscroll-contain py-4 lg:overflow-hidden lg:py-3">
      <div className="flex min-h-0 w-full flex-1 items-center justify-center py-3 sm:py-5">
        <section
          aria-labelledby="import-title"
          className="w-full max-w-[760px] rounded-xl border border-line bg-surface p-4 shadow-sm sm:p-6 lg:max-h-full lg:overflow-y-auto xl:p-7"
        >
          <div className="mb-3 flex items-center gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center border border-line text-xs font-bold text-muted">
              01
            </span>
            <span className="ui-eyebrow">Every adventure starts somewhere</span>
          </div>

          <div className="mb-4">
            <h1
              id="import-title"
              className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
            >
              Bring your trail.
            </h1>
            <p className="mt-1 text-sm text-muted">
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
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-7 text-center transition-colors sm:py-9 ${dragging ? 'border-primary bg-accent' : 'border-line bg-surface-muted'}`}
          >
            <div className="mb-3 flex size-12 items-center justify-center rounded-lg bg-surface-muted text-muted">
              {isLoading ? (
                <LoaderCircle size={25} className="animate-spin" />
              ) : (
                <Upload size={25} />
              )}
            </div>
            <strong
              role="status"
              aria-live="polite"
              className="text-base font-semibold text-foreground"
            >
              {isLoading ? importStage : 'Drop your GPX file here'}
            </strong>
            <p className="mt-1 text-xs text-muted">
              {isLoading
                ? 'Preparing your 3D adventure…'
                : 'Your route will open automatically after import'}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Button
                type="button"
                variant="primary"
                disabled={isLoading}
                onClick={() => inputRef.current?.click()}
                size="sm"
              >
                <Upload size={15} /> Choose GPX file
              </Button>
            </div>
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
            <span className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              .GPX · Up to 25 MB · 300,000 points
            </span>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-3 rounded-lg border border-danger/30 bg-danger-surface px-4 py-3 text-sm text-danger"
            >
              {error}
            </div>
          )}
          <div className="mt-4 flex items-start justify-center gap-2 border-t border-line pt-3 text-xs leading-relaxed text-muted">
            <LockKeyhole size={13} className="mt-0.5 shrink-0" />
            <span>
              GPX stays local. Map providers receive requests for the area you
              view.
            </span>
          </div>
        </section>
      </div>

      <div className="mx-auto hidden w-full max-w-[1100px] shrink-0 grid-cols-3 gap-4 border-t border-line pt-4 xl:grid [@media(max-height:850px)]:hidden">
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
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted">
              <Icon size={19} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-bold text-foreground">{title}</h2>
              <p className="mt-0.5 text-xs text-muted">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
