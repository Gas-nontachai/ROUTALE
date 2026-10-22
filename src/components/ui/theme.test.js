import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((channel) => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
describe.each(['light', 'dark'])('%s theme contrast', (theme) => {
  const block = css.split(`[data-theme='${theme}'] {`)[1].split('}')[0];
  const colors = Object.fromEntries(
    [...block.matchAll(/--ui-([\w-]+): (#[\da-f]{6});/g)].map((match) => [
      match[1],
      match[2],
    ]),
  );
  it.each([
    ['foreground', 'canvas'],
    ['muted', 'canvas'],
    ['foreground', 'surface'],
    ['muted', 'surface'],
    ['muted', 'surface-muted'],
    ['on-primary', 'primary'],
    ['on-primary', 'primary-hover'],
    ['accent-foreground', 'accent'],
    ['danger', 'danger-surface'],
  ])('%s remains readable on %s', (text, surface) => {
    const a = luminance(colors[text]),
      b = luminance(colors[surface]);
    expect(
      (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
