import { Children, isValidElement, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const gpx = {
    status: 'idle',
    error: '',
    activity: null as unknown,
    originalFile: null as File | null,
    set: vi.fn(),
  };
  return {
    gpx,
    setWorld: vi.fn(),
    restart: vi.fn(),
    workers: [] as {
      postMessage: ReturnType<typeof vi.fn>;
      terminate: ReturnType<typeof vi.fn>;
      onmessage?: (event: { data: unknown }) => void;
      onerror?: () => void;
    }[],
    cleanups: [] as (() => void)[],
  };
});
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => [value, vi.fn()],
  useEffect: (effect: () => () => void) => {
    h.cleanups.push(effect());
  },
}));
vi.mock('../stores', () => ({
  useGpxStore: Object.assign(() => h.gpx, { getState: () => h.gpx }),
  useWorldStore: () => ({ setWorld: h.setWorld }),
  useSimulationStore: () => ({ restart: h.restart }),
}));
import { ImportPage } from './ImportPage';

function inputProps(node: ReactNode): Record<string, any> | undefined {
  if (!isValidElement<Record<string, any>>(node)) return;
  if (node.type === 'input') return node.props;
  let result: Record<string, any> | undefined;
  Children.forEach(node.props.children, (child) => {
    result ??= inputProps(child);
  });
  return result;
}
beforeEach(() => {
  Object.assign(h.gpx, {
    status: 'idle',
    error: '',
    activity: null,
    originalFile: null,
  });
  h.gpx.set.mockImplementation((value) => Object.assign(h.gpx, value));
  h.workers.length = 0;
  vi.stubGlobal('window', { setTimeout, clearTimeout });
  vi.stubGlobal(
    'Worker',
    class {
      postMessage = vi.fn();
      terminate = vi.fn();
      constructor() {
        h.workers.push(this);
      }
    },
  );
});
afterEach(() => {
  h.cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it('uses the same validated pipeline for choose/drop, blocks duplicate import and preserves the source on success', async () => {
  const preview = vi.fn();
  const page = ImportPage({ onPreview: preview });
  const file = new File(['<gpx/>'], 'trail.GPX', {
    type: 'application/octet-stream',
  });
  inputProps(page)!.onChange({ target: { files: [file], value: 'trail.GPX' } });
  page.props.onDrop({
    preventDefault: vi.fn(),
    dataTransfer: { files: [file] },
  });
  expect(h.gpx.status).toBe('loading');
  await vi.waitFor(() => expect(h.workers).toHaveLength(1));
  expect(h.workers[0].postMessage).toHaveBeenCalledWith({
    xml: '<gpx/>',
    filename: 'trail.GPX',
  });
  const activity = { name: 'Parsed route' },
    world = { seed: 123 };
  h.workers[0].onmessage!({ data: { activity, world } });
  expect(h.gpx.activity).toBe(activity);
  expect(h.gpx.originalFile).toBe(file);
  expect(h.gpx.status).toBe('ready');
  expect(h.setWorld).toHaveBeenCalledWith(world);
  expect(h.restart).toHaveBeenCalledOnce();
  expect(preview).toHaveBeenCalledOnce();
  expect(h.workers[0].terminate).toHaveBeenCalledOnce();
});
it('reports unsupported and oversized drops without starting a worker', () => {
  const page = ImportPage({ onPreview: vi.fn() });
  const drop = (file: File) =>
    page.props.onDrop({
      preventDefault: vi.fn(),
      dataTransfer: { files: [file] },
    });
  drop(new File(['text'], 'route.txt'));
  expect(h.gpx.error).toContain('valid .gpx');
  const large = new File(['x'], 'large.gpx');
  Object.defineProperty(large, 'size', { value: 26 * 1024 * 1024 });
  drop(large);
  expect(h.gpx.error).toContain('smaller than 25 MB');
  expect(h.workers).toHaveLength(0);
});
it('allows retry after malformed GPX and handles worker failure', async () => {
  const preview = vi.fn();
  const page = ImportPage({ onPreview: preview });
  const change = () =>
    inputProps(page)!.onChange({
      target: { files: [new File(['broken'], 'bad.gpx')], value: 'bad.gpx' },
    });
  change();
  await vi.waitFor(() => expect(h.workers).toHaveLength(1));
  h.workers[0].onmessage!({ data: { error: 'Malformed GPX' } });
  expect(h.gpx.status).toBe('error');
  expect(h.gpx.error).toBe('Malformed GPX');
  change();
  await vi.waitFor(() => expect(h.workers).toHaveLength(2));
  h.workers[1].onerror!();
  expect(h.gpx.error).toBe('Could not process this GPX file.');
  expect(preview).not.toHaveBeenCalled();
});
