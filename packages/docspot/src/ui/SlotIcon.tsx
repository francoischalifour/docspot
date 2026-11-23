import { type ComponentType, createContext, use } from 'react';

import type { DocspotIconProps, DocspotIcons } from '@/types';

/** The icons `slots.icons` replaces, provided by `<Docspot.Root>`. */
export const IconsContext = /* @__PURE__ */ createContext<
  Partial<DocspotIcons> | undefined
>(undefined);

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
  const Custom = use(IconsContext)?.[name];
  if (!Custom) return <Default size={size} className={className} />;
  const props: DocspotIconProps = {
    size,
    className,
    'aria-hidden': true,
    focusable: 'false',
  };
  return <Custom {...props} />;
}
