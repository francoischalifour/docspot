import { type ComponentProps, use } from 'react';

import { useIsApplePlatform } from '@/core/platform';
import { cx } from '@/ui/cx';
import { LocaleContext } from '@/ui/LocaleContext';

const keySymbols: Record<string, string> = {
  enter: '↵',
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
  const labels = use(LocaleContext).keys;
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
              : labels.control
            : key === 'esc'
              ? labels.escape
              : (keySymbols[key] ??
                // Letters print as on the keycap: ⌘K, not ⌘k.
                (key.length === 1 ? key.toUpperCase() : key))}
        </span>
      ))}
    </kbd>
  );
}
