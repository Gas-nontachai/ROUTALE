export function durationLabel(seconds: number | undefined) {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0)
    return 'Not available';
  const h = Math.floor(seconds / 3600),
    m = Math.floor((seconds % 3600) / 60),
    s = Math.floor(seconds % 60);
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
}
