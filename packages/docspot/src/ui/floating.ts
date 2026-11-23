/** Which side of its anchor a floating element prefers. */
export type FloatingSide = 'top' | 'bottom' | 'left';

type FloatingOptions = {
  side: FloatingSide;
  /** Along the anchor: centered, or aligned with its start edge. */
  align?: 'center' | 'start';
  /** Space between the anchor and the floating element, in pixels. */
  gap?: number;
};

/** Floating elements keep this far from the viewport's edges. */
const VIEWPORT_MARGIN = 8;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Where a floating element goes beside its anchor: on its preferred side
 * when it fits, on the opposite side when only that one does, and always
 * inside the viewport.
 */
export function placeFloating(
  anchor: DOMRect,
  size: { width: number; height: number },
  { side, align = 'center', gap = 6 }: FloatingOptions,
  isRtl = false
) {
  const viewport = document.documentElement;
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  const maxLeft = width - size.width - VIEWPORT_MARGIN;
  const maxTop = height - size.height - VIEWPORT_MARGIN;

  if (side === 'left') {
    const before = anchor.left - gap - size.width;
    const after = anchor.right + gap;
    const left = before >= VIEWPORT_MARGIN || after > maxLeft ? before : after;
    return {
      top: clamp(
        anchor.top + anchor.height / 2 - size.height / 2,
        VIEWPORT_MARGIN,
        maxTop
      ),
      left: clamp(left, VIEWPORT_MARGIN, maxLeft),
    };
  }

  const below = anchor.bottom + gap;
  const above = anchor.top - gap - size.height;
  const fitsBelow = below <= maxTop;
  const fitsAbove = above >= VIEWPORT_MARGIN;
  const top =
    side === 'bottom'
      ? fitsBelow || !fitsAbove
        ? below
        : above
      : fitsAbove || !fitsBelow
        ? above
        : below;
  const start = isRtl ? anchor.right - size.width : anchor.left;
  const left =
    align === 'start' ? start : anchor.left + anchor.width / 2 - size.width / 2;
  return {
    top: clamp(top, VIEWPORT_MARGIN, maxTop),
    left: clamp(left, VIEWPORT_MARGIN, maxLeft),
  };
}

/**
 * Keeps a fixed floating element beside its anchor while either moves:
 * when the window resizes or zooms, anything scrolls, or either one's size
 * changes. Returns a function that stops following.
 */
export function anchorFloating(
  anchor: HTMLElement,
  floating: HTMLElement,
  options: FloatingOptions
) {
  let frame = 0;
  function update() {
    const { top, left } = placeFloating(
      anchor.getBoundingClientRect(),
      { width: floating.offsetWidth, height: floating.offsetHeight },
      options,
      getComputedStyle(anchor).direction === 'rtl'
    );
    floating.style.top = `${top}px`;
    floating.style.left = `${left}px`;
  }
  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  }
  update();
  const observer = new ResizeObserver(schedule);
  observer.observe(anchor);
  observer.observe(floating);
  window.addEventListener('resize', schedule);
  // Capture, so scrolling any container moves it too.
  window.addEventListener('scroll', schedule, { capture: true, passive: true });
  window.visualViewport?.addEventListener('resize', schedule);
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener('resize', schedule);
    window.removeEventListener('scroll', schedule, { capture: true });
    window.visualViewport?.removeEventListener('resize', schedule);
  };
}
