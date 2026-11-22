import type { ComponentProps } from 'react';

import { useIsApplePlatform } from '@/core/platform';
import { cx } from '@/ui/cx';

const keyLabels: Record<string, string> = {
  enter: '↵',
  esc: 'Esc',
  tab: '⇥',
  shift: '⇧',
  up: '↑',
  down: '↓',
};

type KbdProps = ComponentProps<'kbd'> & {
  keys: string[];
  variant?: 'default' | 'ghost';
};

/** Keyboard keys. `mod` is ⌘ on Apple platforms and Ctrl elsewhere. */
export function Kbd({
  keys,
  variant = 'default',
  className,
  ...props
}: KbdProps) {
  const isApple = useIsApplePlatform();
  return (
    <kbd
      data-ghost={variant === 'ghost' || undefined}
      className={cx('docspot-kbd', className)}
      {...props}
    >
      {keys.map(key => (
        <span key={key}>
          {key === 'mod'
            ? isApple
              ? '⌘'
              : 'Ctrl'
            : (keyLabels[key] ??
              // Letters print as on the keycap: ⌘K, not ⌘k.
              (key.length === 1 ? key.toUpperCase() : key))}
        </span>
      ))}
    </kbd>
  );
}
