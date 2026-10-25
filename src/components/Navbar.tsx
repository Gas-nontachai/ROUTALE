import { Sun, Moon } from 'lucide-react';
import { Button } from './ui/button';

type NavbarProps = {
  isDark?: boolean;
  onToggleTheme?: () => void;
};

export const Navbar = ({ isDark = false, onToggleTheme }: NavbarProps) => {
  return (
    <header className="relative z-50 w-full bg-[#182E36] text-white">
      <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="min-w-0 text-xl font-bold tracking-tight sm:text-2xl">
            ROUTALE
          </span>

          <span className="hidden rounded bg-white/10 text-[#F28B39] sm:inline-flex px-2 py-1 text-[10px] font-semibold tracking-wider">
            BETA
          </span>
        </div>

        <Button
          variant="inverse"
          size="icon"
          type="button"
          onClick={onToggleTheme}
          disabled={!onToggleTheme}
          aria-label={isDark ? 'Light mode' : 'Dark mode'}
          title={isDark ? 'Light mode' : 'Dark mode'}
          aria-pressed={isDark}
        >
          {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </Button>
      </div>
    </header>
  );
};
