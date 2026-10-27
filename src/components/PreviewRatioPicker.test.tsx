import { expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  focus: vi.fn(),
  menu: { open: true, querySelector: vi.fn() },
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useRef: () => ({ current: h.menu }),
  useEffect: vi.fn(),
}));
import { PreviewRatioPicker } from './PreviewRatioPicker';

it('selects a ratio, closes the menu, and returns focus to the trigger', () => {
  h.menu.open = true;
  h.menu.querySelector.mockReturnValue({ focus: h.focus });
  const onChange = vi.fn();
  const picker = PreviewRatioPicker({ value: '16:9', onChange });
  const options = picker.props.children[1].props.children;
  expect(options.map((option: { key: string }) => option.key)).toEqual([
    '16:9',
    '9:16',
    '4:3',
    '3:4',
    '1:1',
    '21:9',
  ]);
  for (const option of options) {
    const [width, height] = option.key.split(':').map(Number);
    const icon = option.props.children[0].props.children;
    expect(icon.props.style.width / icon.props.style.height).toBeCloseTo(
      width / height,
    );
    expect(Math.max(icon.props.style.width, icon.props.style.height)).toBe(18);
  }
  const trigger = picker.props.children[0].props.children;
  expect(trigger.props['aria-label']).toBe('Aspect ratio');
  expect(trigger.props.children[0].props['aria-hidden']).toBe('true');
  expect(trigger.props.children[1]).toBe('16:9');
  const portrait = options.find(
    (option: { key: string }) => option.key === '9:16',
  );
  portrait.props.onClick();
  expect(onChange).toHaveBeenCalledWith('9:16');
  expect(h.menu.open).toBe(false);
  expect(h.focus).toHaveBeenCalled();
});

it('closes with Escape without changing the selected ratio', () => {
  h.menu.open = true;
  const onChange = vi.fn();
  const preventDefault = vi.fn();
  const picker = PreviewRatioPicker({ value: '16:9', onChange });
  picker.props.onKeyDown({ key: 'Escape', preventDefault });
  expect(h.menu.open).toBe(false);
  expect(preventDefault).toHaveBeenCalled();
  expect(onChange).not.toHaveBeenCalled();
});
