export function paceLabel(seconds?: number) {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0)
    return 'Not available';
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')} /km`;
}
export function metricLabel(
  value: number | undefined,
  unit: string,
  decimals = 0,
) {
  return value === undefined || !Number.isFinite(value)
    ? 'Not available'
    : `${value.toFixed(decimals)} ${unit}`;
}
