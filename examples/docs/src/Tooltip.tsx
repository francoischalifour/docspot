import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import type { DocspotTooltipProps } from 'docspot';

/** The site's tooltip, which Docspot draws its own with too. */
export function Tooltip({
  label,
  shortcut,
  side,
  children,
}: DocspotTooltipProps) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="tooltip-positioner"
        >
          <BaseTooltip.Popup className="tooltip">
            {label}
            {shortcut}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
