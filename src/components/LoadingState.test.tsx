import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { LoadingState } from './LoadingState';

it('announces the current task and respects reduced motion', () => {
  const html = renderToStaticMarkup(
    <LoadingState label="Loading route overview…" className="text-xs" />,
  );
  expect(html).toContain('role="status"');
  expect(html).toContain('aria-live="polite"');
  expect(html).toContain('Loading route overview…');
  expect(html).toContain('motion-reduce:animate-none');
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain('text-xs');
});
