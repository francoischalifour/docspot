import type { ComponentProps } from 'react';

import { cx } from '@/ui/cx';
import { Kbd } from '@/ui/Kbd';
import { useTooltip } from '@/ui/Tooltip';

type IconButtonProps = ComponentProps<'button'> & {
  label: string;
  tooltip?: string;
  shortcut?: string[];
  side?: 'top' | 'bottom' | 'left';
};

/**
 * A button whose label shows on hover and focus. Tooltips repeat the
 * accessible name, so screen readers hear it once.
 */
export function IconButton({
  label,
  tooltip,
  shortcut,
  className,
  children,
  side = 'bottom',
  ...props
}: IconButtonProps) {
  const withTooltip = useTooltip({
    label: tooltip ?? label,
    side,
    shortcut: shortcut && <Kbd variant="ghost" keys={shortcut} />,
  });
  return withTooltip(
    <button
      type="button"
      aria-label={label}
      className={cx('docspot-icon-button', className)}
      {...props}
    >
      {children}
    </button>
  );
}
