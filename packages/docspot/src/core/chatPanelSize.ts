// The docked chat panel's widths, and how it moves while resized or hidden.

/** Matches the 25rem width the stylesheet docks the panel at. */
export const PANEL_DEFAULT_WIDTH = 400;

export const PANEL_MIN_WIDTH = 320;

export const PANEL_MAX_WIDTH = 640;

/** Releasing a drag this far past the minimum width hides the panel. */
export const PANEL_HIDE_DISTANCE = 80;

/** A flick hides the panel from a shorter distance. */
export const PANEL_FLICK_HIDE_DISTANCE = 24;

/** In pixels per millisecond. */
export const PANEL_FLICK_VELOCITY = 0.5;

export const PANEL_SLIDE_EASING = 'cubic-bezier(0.23, 1, 0.32, 1)';

export type PanelResize = {
  width: number;
  /** How far a drag goes past the minimum width. */
  overshoot: number;
};

export function clampPanelWidth(width: number) {
  return Math.round(
    Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, width))
  );
}

/**
 * Moves the panel by a signed offset, right when positive, filling the
 * space it leaves with the page color.
 */
export function getPanelOffsetStyle(offset: number) {
  return {
    transform: `translateX(${offset}px)`,
    boxShadow: `${-offset}px 0 var(--docspot-background)`,
  };
}

/** Fades the panel content until releasing would hide it. */
export function getPanelContentOpacity(offset: number) {
  return 1 - Math.min(Math.abs(offset) / PANEL_HIDE_DISTANCE, 1) * 0.6;
}
