import { parseGpx, createWorld } from './route';
self.onmessage = ({
  data,
}: MessageEvent<{ xml: string; filename: string }>) => {
  try {
    const activity = parseGpx(data.xml, data.filename);
    self.postMessage({ stage: 'Filtering GPS noise and analyzing movement…' });
    self.postMessage({ activity, world: createWorld(activity) });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error
          ? error.message
          : 'Could not read this GPX file.',
    });
  }
};
