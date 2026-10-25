import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ActivityTypeBadge } from './ActivityTypeBadge';
it.each([
  ['Cycling', 'bike'],
  ['Running', 'footprints'],
  ['Walking', 'footprints'],
  ['Hiking', 'mountain'],
  ['Trail Running', 'mountain'],
  ['Kayaking', 'route'],
])('shows an accessible %s icon without a badge', (type, icon) => {
  const html = renderToStaticMarkup(<ActivityTypeBadge type={type} />);
  expect(html).toContain(`lucide-${icon}`);
  expect(html).toContain(`aria-label="${type}"`);
  expect(html).toContain(`title="${type}"`);
  expect(html).not.toContain('bg-');
  expect(html).not.toContain('border');
});
it('omits unknown or empty activity types instead of inventing a label', () => {
  expect(renderToStaticMarkup(<ActivityTypeBadge />)).toBe('');
  expect(renderToStaticMarkup(<ActivityTypeBadge type="  " />)).toBe('');
});
