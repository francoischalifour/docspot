import {
  type ComponentProps,
  type ReactNode,
  createContext,
  use,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { prefersReducedMotion } from '../core/platform';
import { ArrowDownIcon } from '../ui/icons';
import { cx } from '../ui/primitives';

const END_TOLERANCE = 8;

type ScrollerApi = {
  /** Scrolls an answer's start to the top and keeps it there while it grows. */
  startReadingAt: (element: HTMLElement) => void;
};

const ScrollerContext = /* @__PURE__ */ createContext<ScrollerApi | null>(null);

function getAnchorTop(viewport: HTMLElement, element: HTMLElement) {
  const scrollMarginTop =
    Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
  return (
    viewport.scrollTop +
    element.getBoundingClientRect().top -
    viewport.getBoundingClientRect().top -
    scrollMarginTop
  );
}

function distanceToEnd(viewport: HTMLElement) {
  return viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop;
}

/**
 * A conversation that opens at its end, follows a new question's answer
 * until the reader scrolls, and anchors a streamed answer's start at the
 * top so it reads from the beginning.
 */
export function Scroller({
  follow,
  followKey,
  jumpLabel,
  className,
  viewportClassName,
  children,
  footer,
}: {
  /** Follows content growth, for example while an answer streams. */
  follow: boolean;
  /** Changes when a new question starts, to follow again. */
  followKey: string | undefined;
  jumpLabel: string;
  className?: string;
  viewportClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const wasAtEndRef = useRef(true);
  const previousScrollTopRef = useRef(0);
  const anchorRef = useRef<HTMLElement | null>(null);
  // Whether the reader has left the anchored answer's start.
  const alignedRef = useRef(false);
  const [edges, setEdges] = useState({ start: false, end: false });
  const [resumeKey, setResumeKey] = useState(0);

  const updateEdges = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const start = viewport.scrollTop > 1;
    const end = distanceToEnd(viewport) > END_TOLERANCE;
    setEdges(current =>
      current.start === start && current.end === end ? current : { start, end }
    );
  }, []);

  function releaseAnchor() {
    const viewport = viewportRef.current;
    alignedRef.current = false;
    if (anchorRef.current) {
      anchorRef.current.style.minHeight = '';
      anchorRef.current = null;
    }
    if (viewport) viewport.style.overflowAnchor = '';
  }

  // Opens at the end of a saved conversation.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
    updateEdges();
  }, [updateEdges]);

  // A resized panel keeps the answer being read at its top.
  const onViewportResize = useCallback(() => {
    const viewport = viewportRef.current;
    const anchor = anchorRef.current;
    // An unconstrained viewport grows with its content; resizing the
    // anchor then would only make it grow further.
    const scrolls = viewport && viewport.scrollHeight > viewport.clientHeight;
    if (viewport && anchor && scrolls) {
      anchor.style.minHeight = `${viewport.clientHeight}px`;
      if (alignedRef.current)
        viewport.scrollTop = getAnchorTop(viewport, anchor);
    }
    updateEdges();
  }, [updateEdges]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(onViewportResize);
    observer.observe(viewport);
    if (viewport.firstElementChild)
      observer.observe(viewport.firstElementChild);
    return () => observer.disconnect();
  }, [onViewportResize]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    wasAtEndRef.current = distanceToEnd(viewport) <= END_TOLERANCE;
    if (!follow && !resumeKey) return;
    followRef.current = true;
    wasAtEndRef.current = true;
    releaseAnchor();
    if (!follow) return;
    let frame: number | null = null;
    function scrollToEnd() {
      viewport!.scrollTop = viewport!.scrollHeight - viewport!.clientHeight;
      previousScrollTopRef.current = viewport!.scrollTop;
    }
    function schedule() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = null;
        if (followRef.current) scrollToEnd();
      });
    }
    scrollToEnd();
    const observer = new ResizeObserver(schedule);
    observer.observe(viewport);
    if (viewport.firstElementChild)
      observer.observe(viewport.firstElementChild);
    schedule();
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [follow, followKey, resumeKey]);

  const api: ScrollerApi = {
    startReadingAt(element) {
      const viewport = viewportRef.current;
      if (!viewport || !wasAtEndRef.current) return;
      followRef.current = false;
      anchorRef.current = element;
      alignedRef.current = true;
      element.style.minHeight = `${viewport.clientHeight}px`;
      viewport.style.overflowAnchor = 'none';
      viewport.scrollTo({
        top: getAnchorTop(viewport, element),
        behavior: prefersReducedMotion() ? 'instant' : 'smooth',
      });
    },
  };

  return (
    <div className={cx('docspot-scroller', className)}>
      <div
        ref={viewportRef}
        className={cx('docspot-scroller-viewport', viewportClassName)}
        onScroll={event => {
          const viewport = event.currentTarget;
          const atEnd = distanceToEnd(viewport) <= END_TOLERANCE;
          wasAtEndRef.current = atEnd;
          const scrolledDown =
            viewport.scrollTop > previousScrollTopRef.current;
          const scrolledPastAnchor =
            anchorRef.current &&
            anchorRef.current.getBoundingClientRect().top <
              viewport.getBoundingClientRect().top - END_TOLERANCE;
          if (
            atEnd &&
            (!anchorRef.current || (scrolledDown && scrolledPastAnchor))
          ) {
            releaseAnchor();
            followRef.current = true;
          } else if (viewport.scrollTop < previousScrollTopRef.current)
            followRef.current = false;
          previousScrollTopRef.current = viewport.scrollTop;
          updateEdges();
        }}
        onWheel={event => {
          alignedRef.current = false;
          if (event.deltaY < 0) followRef.current = false;
        }}
        onTouchMove={() => {
          alignedRef.current = false;
          followRef.current = false;
        }}
        onKeyDown={event => {
          alignedRef.current = false;
          if (
            ['ArrowUp', 'PageUp', 'Home'].includes(event.key) ||
            (event.key === ' ' && event.shiftKey)
          )
            followRef.current = false;
        }}
      >
        <ScrollerContext value={api}>{children}</ScrollerContext>
      </div>
      <div aria-hidden="true" className="docspot-scroller-edges">
        <div data-edge="start" data-active={edges.start} />
        <div data-edge="end" data-active={edges.end} />
      </div>
      <button
        type="button"
        className="docspot-jump"
        data-active={edges.end}
        tabIndex={edges.end ? 0 : -1}
        aria-hidden={!edges.end}
        aria-label={jumpLabel}
        onClick={() => {
          const viewport = viewportRef.current;
          if (viewport) viewport.scrollTop = viewport.scrollHeight;
          setResumeKey(key => key + 1);
        }}
      >
        <ArrowDownIcon size={14} />
      </button>
      {footer}
    </div>
  );
}

export function ReadingAnchor({
  active,
  ...props
}: ComponentProps<'div'> & { active: boolean }) {
  const scroller = use(ScrollerContext);
  const elementRef = useRef<HTMLDivElement>(null);
  const wasActiveRef = useRef(false);
  useLayoutEffect(() => {
    if (active && !wasActiveRef.current && elementRef.current)
      scroller?.startReadingAt(elementRef.current);
    wasActiveRef.current = active;
  }, [active, scroller]);
  return <div ref={elementRef} {...props} />;
}
