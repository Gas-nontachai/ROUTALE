import { useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from './ui/button';

function ratioIcon(ratio: string) {
  const [width, height] = ratio.split(':').map(Number);
  const scale = 18 / Math.max(width, height);
  return (
    <span
      className="inline-flex size-5 shrink-0 items-center justify-center"
      aria-hidden="true"
    >
      <span
        className="block rounded-[2px] border-2 border-current"
        style={{ width: width * scale, height: height * scale }}
      />
    </span>
  );
}

export function PreviewRatioPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (ratio: string) => void;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => {
    if (!menu.current) return;
    menu.current.open = false;
    menu.current.querySelector('summary')?.focus();
  };

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node)) {
        menu.current.open = false;
      }
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);

  return (
    <details
      ref={menu}
      className="relative shrink-0"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
        }
      }}
    >
      <Button
        asChild
        variant="outline"
        className="cursor-pointer list-none [&::-webkit-details-marker]:hidden"
      >
        <summary aria-label="Aspect ratio">
          {ratioIcon(value)}
          {value}
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
      </Button>
      <div
        role="group"
        aria-label="Aspect ratios"
        className="absolute bottom-full right-0 z-30 mb-2 grid w-36 gap-1 rounded-md border border-line bg-surface p-1 shadow-lg"
      >
        {['16:9', '9:16', '4:3', '3:4', '1:1', '21:9'].map((ratio) => (
          <Button
            key={ratio}
            variant={value === ratio ? 'soft' : 'ghost'}
            aria-pressed={value === ratio}
            onClick={() => {
              onChange(ratio);
              close();
            }}
          >
            {ratioIcon(ratio)}
            {ratio}
          </Button>
        ))}
      </div>
    </details>
  );
}
