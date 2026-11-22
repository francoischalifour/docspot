import type { ComponentProps } from 'react';

import { cx } from '@/ui/cx';
import { Kbd } from '@/ui/Kbd';

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
  return (
    <span className="docspot-tooltip-anchor" data-side={side}>
      <button
        type="button"
        aria-label={label}
        className={cx('docspot-icon-button', className)}
        {...props}
      >
        {children}
      </button>
      <span className="docspot-tooltip" aria-hidden="true">
        {tooltip ?? label}
        {shortcut && <Kbd variant="ghost" keys={shortcut} />}
      </span>
    </span>
  );
}
