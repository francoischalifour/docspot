import { type ComponentType, use } from 'react';

import type { DocspotIconProps, DocspotIcons, DocspotPage } from '@/types';
import { SlotsContext } from '@/ui/SlotsContext';

type SlotIconProps = {
  /** What the icon means, as `slots.icons` names it. */
  name: keyof DocspotIcons;
  /** Docspot's own icon, drawn unless `slots.icons` replaces it. */
  icon: ComponentType<{ size?: number; className?: string }>;
  size?: number;
  className?: string;
};

/**
 * An icon a site can replace through `slots.icons`. Each caller names its
 * default, so an entry point only loads the icons it draws.
 */
export function SlotIcon({
  name,
  icon: Default,
  size = 16,
  className,
}: SlotIconProps) {
  const Custom = use(SlotsContext)?.icons?.[name];
  if (!Custom) return <Default size={size} className={className} />;
  const props: DocspotIconProps = {
    size,
    className,
    'aria-hidden': true,
    focusable: 'false',
  };
  return <Custom {...props} />;
}

/** A page's icon: the site's through `slots.pageIcon`, else `page`. */
export function PageSlotIcon({
  page,
  icon,
  size = 16,
  className,
}: {
  page: DocspotPage;
  icon: SlotIconProps['icon'];
  size?: number;
  className?: string;
}) {
  const PageIcon = use(SlotsContext)?.pageIcon;
  if (!PageIcon)
    return (
      <SlotIcon name="page" icon={icon} size={size} className={className} />
    );
  return (
    <PageIcon
      page={page}
      size={size}
      className={className}
      aria-hidden
      focusable="false"
    />
  );
}
