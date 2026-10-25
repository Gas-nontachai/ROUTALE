import { Copyright, X } from 'lucide-react';
import { useRef } from 'react';
import { Button } from './ui/button';

export const Footer = () => {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <footer className="flex w-full shrink-0 flex-wrap items-center justify-between gap-x-4 border-t border-line bg-canvas px-4 text-xs text-muted sm:px-6">
      <span className="hidden lg:inline">Every route has more to tell.</span>
      <div className="flex flex-wrap items-center gap-x-2 py-2 text-xs">
        <a
          href="https://openmaptiles.org/"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          © OpenMapTiles
        </a>
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          © OpenStreetMap
        </a>
      </div>
      <Button
        ref={trigger}
        variant="ghost"
        size="icon"
        aria-label="Licenses & map credits"
        title="Licenses & map credits"
        onClick={() => dialog.current?.showModal()}
      >
        <Copyright size={18} aria-hidden="true" />
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby="credits-title"
        onClose={() => trigger.current?.focus()}
        className="m-auto max-h-[85dvh] w-[min(560px,calc(100%-24px))] overflow-y-auto rounded-lg border border-line bg-surface p-6 text-foreground backdrop:bg-black/50"
      >
        <header className="flex items-center justify-between gap-3">
          <h2 id="credits-title" className="text-xl font-bold">
            Credits &amp; licenses
          </h2>
          <form method="dialog">
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              aria-label="Close credits"
              title="Close"
            >
              <X size={20} aria-hidden="true" />
            </Button>
          </form>
        </header>
        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="font-semibold">Maps</dt>
            <dd className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted">
              <a
                href="https://openfreemap.org/"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                OpenFreeMap
              </a>
              <a
                href="https://openmaptiles.org/"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                © OpenMapTiles
              </a>
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                © OpenStreetMap contributors
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Terrain</dt>
            <dd className="mt-1 text-muted">
              <a
                href="https://mapterhorn.com/attribution"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                © Mapterhorn
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Satellite imagery</dt>
            <dd className="mt-1 text-muted">
              <a
                href="https://maps.eox.at/"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                EOX Sentinel-2 cloudless 2016
              </a>{' '}
              ·{' '}
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                CC BY 4.0
              </a>
              <p className="mt-1">
                Contains modified Copernicus Sentinel data 2016.
              </p>
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Font</dt>
            <dd className="mt-1 text-muted">
              <a
                href="/licenses/Kanit-OFL.txt"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                Kanit · SIL Open Font License
              </a>
            </dd>
          </div>
        </dl>
      </dialog>
    </footer>
  );
};
