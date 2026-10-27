import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

const preview = vi.hoisted(() => ({ ratio: '16:9' }));
const playback = vi.hoisted(() => ({
  restart: vi.fn(),
  begin: vi.fn(),
  status: 'Ready',
  onReplay: undefined as (() => void) | undefined,
}));
vi.mock('../components/JourneySummary', () => ({
  JourneySummary: ({ onReplay }: { onReplay: () => void }) => {
    playback.onReplay = onReplay;
    return null;
  },
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState: () => [preview.ratio, vi.fn()],
}));
vi.mock('../hooks/useJourney', () => ({
  useJourney: () => ({ journey: { reducedMotion: false } }),
}));
vi.mock('../stores', () => ({
  useGpxStore: () => ({
    activity: { name: 'Preview route', type: 'running', distance: 1000 },
  }),
  useWorldStore: () => ({
    world: {
      seed: 1,
      duration: 60,
      distance: 1000,
      processed: { stats: { distance: 1000, ascent: 10 } },
    },
  }),
  useSimulationStore: () => ({
    status: playback.status,
    elapsed: 0,
    distance: 0,
    completion: 0,
    speed: 1,
    restart: playback.restart,
    begin: playback.begin,
  }),
}));
import { JourneyPage } from './JourneyPage';

it('returns Replay to the start without automatically playing', () => {
  playback.restart.mockClear();
  playback.begin.mockClear();
  playback.status = 'Completed';
  renderToStaticMarkup(<JourneyPage onBack={() => {}} />);
  playback.status = 'Ready';
  expect(playback.onReplay).toBeTypeOf('function');
  playback.onReplay!();
  expect(playback.restart).toHaveBeenCalledOnce();
  expect(playback.begin).not.toHaveBeenCalled();
});

it.each(['16:9', '9:16', '4:3', '3:4', '1:1', '21:9'])(
  'renders a selectable %s preview bounded by the available width and height',
  (ratio) => {
    preview.ratio = ratio;
    const html = renderToStaticMarkup(<JourneyPage onBack={() => {}} />);
    expect(html).toContain('aria-label="Aspect ratio"');
    const selectedOption = html.match(
      /<button[^>]*aria-pressed="true">.*?<\/button>/,
    );
    expect(selectedOption?.[0]).toContain(`${ratio}</button>`);
    expect(html).not.toContain('<select');
    expect(html).toMatch(/<\/section><div[^>]*aria-label="Journey summary"/);
    const cssRatio = ratio.replace(':', ' / ');
    expect(html).toContain(`aspect-ratio:${cssRatio}`);
    expect(html).toContain(`width:min(100cqw, calc(100cqh * ${cssRatio}))`);
  },
);
