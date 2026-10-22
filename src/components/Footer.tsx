import { Leaf, Trees } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="flex w-full shrink-0 flex-col items-center justify-between gap-2 border-t border-line bg-canvas px-3 py-2 text-[10px] font-semibold tracking-[0.04em] text-muted sm:flex-row sm:px-5 sm:py-3 sm:text-xs sm:tracking-[0.08em] lg:px-10">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <Trees
          size={15}
          strokeWidth={1.8}
          aria-hidden="true"
          className="text-muted"
        />
        <span className="uppercase">Made for the wanderers.</span>
      </div>

      {/* Message */}
      <div className="hidden items-center gap-2 text-center normal-case tracking-normal md:flex">
        <span>A little less scrolling. A little more exploring.</span>
        <Leaf size={13} aria-hidden="true" className="text-muted" />
      </div>

      {/* Map data credits */}
      <div className="flex flex-wrap items-center justify-center gap-x-1">
        <span className="sr-only">Map data: </span>
        <a
          href="https://openfreemap.org/"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          OpenFreeMap
        </a>
        <span>·</span>
        <a
          href="https://openmaptiles.org/"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          © OpenMapTiles
        </a>
        <span>·</span>
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          © OpenStreetMap contributors
        </a>
        <span>·</span>
        <a
          href="https://mapterhorn.com/attribution"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          © Mapterhorn
        </a>
        <span>·</span>
        <a
          href="https://maps.eox.at/"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          EOX Sentinel-2 imagery
        </a>
        <span>(</span>
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          CC BY 4.0
        </a>
        <span>)</span>
      </div>
    </footer>
  );
};
