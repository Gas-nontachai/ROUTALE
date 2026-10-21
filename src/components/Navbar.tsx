import { Mountain, Sun, Moon } from 'lucide-react';

type NavbarProps = {
  isDark?: boolean;
  onToggleTheme?: () => void;
};

export const Navbar = ({ isDark = false, onToggleTheme }: NavbarProps) => {
  return (
    <header className="relative z-50 w-full bg-[#173D30] text-white">
      <div className="flex h-16 w-full items-center justify-between px-5 lg:px-10">
        <div className="flex items-center gap-3">
          <Mountain className="size-8 text-[#A5D886]" />

          <span className="text-base font-bold tracking-tight sm:text-lg">
            GPX Pixel Adventure
          </span>

          <span className="rounded bg-white/15 px-2 py-1 text-[10px] font-semibold tracking-wider">
            BETA
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          disabled={!onToggleTheme}
          aria-label={isDark ? 'Light mode' : 'Dark mode'}
          className="rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </button>
      </div>
    </header>
  );
};
