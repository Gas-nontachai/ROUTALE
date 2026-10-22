import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from './button';

it('defaults to a non-submitting button and preserves explicit submit actions', () => {
  expect(renderToStaticMarkup(<Button>Replay</Button>)).toContain(
    'type="button"',
  );
  expect(renderToStaticMarkup(<Button type="submit">Import</Button>)).toContain(
    'type="submit"',
  );
});
it('exposes loading state and disables repeat actions', () => {
  const html = renderToStaticMarkup(<Button loading>Import</Button>);
  expect(html).toContain('disabled=""');
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain('Loading…');
});
it('keeps link semantics when composing a child', () => {
  const html = renderToStaticMarkup(
    <Button asChild>
      <a href="#summary">Summary</a>
    </Button>,
  );
  expect(html).toContain('<a');
  expect(html).not.toContain('type="button"');
});
