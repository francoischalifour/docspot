import {
  type ReactElement,
  type ReactNode,
  use,
  useEffect,
  useRef,
} from 'react';

import { type FloatingSide, anchorFloating } from '@/ui/floating';
import { SlotsContext } from '@/ui/SlotsContext';

type TooltipOptions = {
  /** Shown beside the trigger; the trigger has it as its accessible name. */
  label: string;
  shortcut?: ReactNode;
  side?: FloatingSide;
};

/** How long a pointer rests on a trigger before its tooltip shows. */
const SHOW_DELAY_MS = 400;
// Moving on to another trigger soon after shows its tooltip at once.
const WARM_MS = 300;
let lastHiddenAt = 0;

/**
 * A label beside a trigger on hover and keyboard focus, or the site's own
 * tooltip through `slots.tooltip`. Returns what wraps the trigger. A hook
 * rather than a component, so a button with a tooltip is one component to
 * render. Docspot's own is a popover in the top layer, so no panel clips
 * it, kept beside its trigger inside the viewport.
 */
export function useTooltip({
  label,
  shortcut,
  side = 'bottom',
}: TooltipOptions): (trigger: ReactElement) => ReactElement {
  const Custom = use(SlotsContext)?.tooltip;
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stopRef = useRef<(() => void) | null>(null);

  function show() {
    const anchor = anchorRef.current;
    const tip = tipRef.current;
    if (!anchor || !tip || tip.matches(':popover-open')) return;
    tip.showPopover();
    stopRef.current = anchorFloating(anchor, tip, { side });
  }

  function hide() {
    clearTimeout(timerRef.current);
    stopRef.current?.();
    stopRef.current = null;
    const tip = tipRef.current;
    if (!tip?.matches(':popover-open')) return;
    tip.hidePopover();
    lastHiddenAt = performance.now();
  }

  function showSoon() {
    clearTimeout(timerRef.current);
    if (performance.now() - lastHiddenAt < WARM_MS) show();
    else timerRef.current = setTimeout(show, SHOW_DELAY_MS);
  }

  useEffect(() => hide, []);

  if (Custom)
    return trigger => (
      <Custom label={label} shortcut={shortcut} side={side}>
        {trigger}
      </Custom>
    );
  return trigger => (
    <span
      ref={anchorRef}
      className="docspot-tooltip-anchor"
      onPointerEnter={event => {
        if (event.pointerType === 'mouse') showSoon();
      }}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={event => {
        if (event.target.matches(':focus-visible')) showSoon();
      }}
      onBlur={hide}
      onKeyDown={event => {
        if (event.key === 'Escape') hide();
      }}
    >
      {trigger}
      <span
        ref={tipRef}
        popover="manual"
        className="docspot-tooltip"
        aria-hidden="true"
      >
        {label}
        {shortcut}
      </span>
    </span>
  );
}
