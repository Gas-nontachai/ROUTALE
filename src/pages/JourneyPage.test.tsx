import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

const preview = vi.hoisted(() => ({ ratio: '16:9' }));
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
    status: 'Ready',
    elapsed: 0,
    distance: 0,
    completion: 0,
    speed: 1,
  }),
}));
import { JourneyPage } from './JourneyPage';

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
