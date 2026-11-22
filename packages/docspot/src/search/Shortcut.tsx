import type { DocspotSlots } from '@/types';
import { Kbd } from '@/ui/Kbd';

/** Key names as `aria-keyshortcuts` writes them, drawn as on the keyboard. */
const shortcutKeys: Record<string, string> = {
  meta: '⌘',
  control: 'Ctrl',
  alt: '⌥',
  shift: 'shift',
  enter: 'enter',
  escape: 'esc',
  arrowup: 'up',
  arrowdown: 'down',
};

type ShortcutProps = {
  shortcut: string;
  slots: DocspotSlots;
};

/** An item's shortcut, `Meta+S` as ⌘ S, unless the `shortcut` slot draws it. */
export function Shortcut({ shortcut, slots }: ShortcutProps) {
  const Slot = slots.shortcut;
  if (Slot) return <Slot shortcut={shortcut} />;
  return (
    <Kbd
      variant="ghost"
      keys={shortcut
        .split('+')
        .map(key => shortcutKeys[key.toLowerCase()] ?? key.toUpperCase())}
    />
  );
}
