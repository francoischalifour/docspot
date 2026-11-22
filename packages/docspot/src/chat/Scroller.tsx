import {
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { prefersReducedMotion } from '@/core/platform';
import {
  type ScrollMode,
  type ScrollModeEvent,
  following,
  scrollMode,
} from '@/chat/scrollMode';
import { ArrowDownIcon } from '@/ui/icons';
import { type ScrollerApi, ScrollerContext } from '@/chat/ScrollerContext';

const END_TOLERANCE = 8;
const UPWARD_KEYS = new Set(['ArrowUp', 'PageUp', 'Home']);

function anchorOf(state: ScrollMode) {
  return state.mode === 'anchored' ? state.anchor : null;
}

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
 * How far the conversation's content reaches below the visible area. An
 * anchored answer reserves a viewport of space below it so its start can
 * sit at the top; that space is not content to scroll to.
 */
function distanceToContentEnd(
  viewport: HTMLElement,
  anchor: HTMLElement | null
) {
  const content = anchor?.lastElementChild;
  if (!anchor || !content) return distanceToEnd(viewport);
  const reserved =
    anchor.getBoundingClientRect().bottom -
    content.getBoundingClientRect().bottom;
  return distanceToEnd(viewport) - Math.max(0, reserved);
}

type ScrollerProps = {
  /** Follows content growth, for example while an answer streams. */
  follow: boolean;
  /** Changes when a new question starts, to follow again. */
  followKey: string | undefined;
  jumpLabel: string;
  children: ReactNode;
};

/**
 * A conversation that opens at its end, follows a new question's answer
 * until the reader scrolls, and anchors a streamed answer's start at the
 * top so it reads from the beginning.
 */
export function Scroller({
  follow,
  followKey,
  jumpLabel,
  children,
}: ScrollerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  // Changes on every scroll, so it stays out of React state.
  const modeRef = useRef<ScrollMode>(following);
  // Where the viewport is, apart from the mode: an answer anchors only when
  // the reader was at the end.
  const atEndRef = useRef(true);
  const previousScrollTopRef = useRef(0);
  // Follows the anchored answer's growth inside its reserved space.
  const anchorObserverRef = useRef<ResizeObserver | null>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const [resumeKey, setResumeKey] = useState(0);

  const updateEdges = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const start = viewport.scrollTop > 1;
    const end =
      distanceToContentEnd(viewport, anchorOf(modeRef.current)) > END_TOLERANCE;
    setEdges(current =>
      current.start === start && current.end === end ? current : { start, end }
    );
  }, []);

  /**
   * Applies a mode event and the DOM effects of entering or leaving an
   * anchored answer: the space reserved below it, and watching its growth.
   */
  function transition(event: ScrollModeEvent) {
    const previous = modeRef.current;
    const next = scrollMode(previous, event);
    if (next === previous) return;
    modeRef.current = next;
    const viewport = viewportRef.current;
    const left = anchorOf(previous);
    const entered = anchorOf(next);
    if (left && left !== entered) {
      anchorObserverRef.current?.disconnect();
      anchorObserverRef.current = null;
      left.style.minHeight = '';
      if (viewport) viewport.style.overflowAnchor = '';
    }
    if (entered && entered !== left && viewport) {
      entered.style.minHeight = `${viewport.clientHeight}px`;
      viewport.style.overflowAnchor = 'none';
      anchorObserverRef.current = new ResizeObserver(updateEdges);
      if (entered.lastElementChild)
        anchorObserverRef.current.observe(entered.lastElementChild);
    }
  }

  useLayoutEffect(() => () => anchorObserverRef.current?.disconnect(), []);

  // Opens at the end of a saved conversation.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
    updateEdges();
  }, [updateEdges]);

  // A resized panel keeps the answer being read at its top.
  const onViewportResize = useCallback(() => {
    const viewport = viewportRef.current;
    const mode = modeRef.current;
    const anchor = anchorOf(mode);
    // An unconstrained viewport grows with its content; resizing the
    // anchor then would only make it grow further.
    const scrolls = viewport && viewport.scrollHeight > viewport.clientHeight;
    if (viewport && anchor && scrolls) {
      anchor.style.minHeight = `${viewport.clientHeight}px`;
      if (mode.mode === 'anchored' && mode.aligned)
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
    atEndRef.current = distanceToEnd(viewport) <= END_TOLERANCE;
    if (!follow && !resumeKey) return;
    atEndRef.current = true;
    transition({ type: 'follow' });
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
        if (modeRef.current.mode === 'following') scrollToEnd();
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
      if (!viewport || !atEndRef.current) return;
      transition({ type: 'anchor', anchor: element });
      viewport.scrollTo({
        top: getAnchorTop(viewport, element),
        behavior: prefersReducedMotion() ? 'instant' : 'smooth',
      });
    },
  };

  return (
    <div className="docspot-scroller">
      <div
        ref={viewportRef}
        className="docspot-scroller-viewport"
        onScroll={event => {
          const viewport = event.currentTarget;
          const atEnd = distanceToEnd(viewport) <= END_TOLERANCE;
          atEndRef.current = atEnd;
          const anchor = anchorOf(modeRef.current);
          transition({
            type: 'scrolled',
            atEnd,
            upward: viewport.scrollTop < previousScrollTopRef.current,
            downward: viewport.scrollTop > previousScrollTopRef.current,
            pastAnchor: Boolean(
              anchor &&
              anchor.getBoundingClientRect().top <
                viewport.getBoundingClientRect().top - END_TOLERANCE
            ),
          });
          previousScrollTopRef.current = viewport.scrollTop;
          updateEdges();
        }}
        onWheel={event =>
          transition({ type: 'userScroll', upward: event.deltaY < 0 })
        }
        // A touch may scroll either way; it stops following like scrolling up.
        onTouchMove={() => transition({ type: 'userScroll', upward: true })}
        onKeyDown={event =>
          transition({
            type: 'userScroll',
            upward:
              UPWARD_KEYS.has(event.key) ||
              (event.key === ' ' && event.shiftKey),
          })
        }
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
    </div>
  );
}
