import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { JourneyBoundary } from './App';

it('keeps the journey visible normally and offers recovery after a failed download', () => {
  const boundary = new JourneyBoundary({ children: <p>Your journey</p> });
  expect(renderToStaticMarkup(boundary.render())).toContain('Your journey');
  boundary.state = JourneyBoundary.getDerivedStateFromError();
  const html = renderToStaticMarkup(boundary.render());
  expect(html).toContain('role="alert"');
  expect(html).toContain('reload to import your GPX again');
  expect(html).toContain('Reload Routale</button>');
  expect(html).not.toContain('Your journey');
});
