import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Measures the footer floating over the conversation. A conversation read to
 * its end stays there as the footer grows or shrinks, for example when page
 * suggestions appear.
 */
export function useFloatingFooter() {
  const [footer, setFooter] = useState<HTMLDivElement | null>(null);
  const [footerHeight, setFooterHeight] = useState(0);
  const pinnedToEndRef = useRef(true);
  const viewportRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!footer) return;
    const viewport = footer.parentElement?.querySelector<HTMLElement>(
      '.docspot-scroller-viewport'
    );
    viewportRef.current = viewport ?? null;
    function updatePinned() {
      if (viewport)
        pinnedToEndRef.current =
          viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <=
          8;
    }
    viewport?.addEventListener('scroll', updatePinned, { passive: true });
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setFooterHeight(entry.borderBoxSize[0]?.blockSize ?? 0);
    });
    observer.observe(footer);
    return () => {
      observer.disconnect();
      viewport?.removeEventListener('scroll', updatePinned);
    };
  }, [footer]);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (viewport && pinnedToEndRef.current)
      viewport.scrollTop = viewport.scrollHeight;
  }, [footerHeight]);
  return { setFooter, footerHeight };
}
