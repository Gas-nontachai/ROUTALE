import { Leaf, Trees } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="flex w-full shrink-0 flex-col items-center justify-between gap-2 border-t border-line bg-canvas px-5 py-3 text-xs font-semibold tracking-[0.08em] text-muted sm:flex-row lg:px-10">
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

      {/* Copyright */}
      <div className="flex items-center gap-2">
        <span>© {new Date().getFullYear()} GPX Pixel Adventure</span>
      </div>
    </footer>
  );
};
