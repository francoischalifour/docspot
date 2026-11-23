import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  useEffect,
  useLayoutEffect,
  useSyncExternalStore,
} from 'react';

// A page that never idles, such as one running animations, still preloads.
const IDLE_PRELOAD_TIMEOUT_MS = 2_000;

const APPLE_PLATFORM = /Mac|iPhone|iPad|iPod/;
let isApple: boolean | undefined;

/**
 * Whether this is an Apple platform (macOS, iOS, or iPadOS), whose
 * keyboards label the command key ⌘.
 */
export function isApplePlatform() {
  // The platform never changes, and this runs on every key hint's render.
  isApple ??=
    typeof navigator !== 'undefined' &&
    APPLE_PLATFORM.test(navigator.platform || navigator.userAgent);
  return isApple;
}

const subscribeToNothing = () => () => {};

/**
 * `isApplePlatform` for rendering. The server and hydration render Ctrl, so
 * the markup matches before the platform is read.
 */
export function useIsApplePlatform() {
  return useSyncExternalStore(subscribeToNothing, isApplePlatform, () => false);
}

export function hasModifierKey(event: MouseEvent | KeyboardEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

const LATIN_LETTER = /^[a-z]$/i;

/**
 * True for ⌘ or Ctrl plus the letter `key`, on any platform, without Alt or
 * Shift. The letter typed decides on Latin layouts, including remapped ones
 * such as Dvorak; on others, such as Russian or Greek, where the key types
 * another letter, its position on a QWERTY keyboard does.
 */
export function isCommandKey(
  event: KeyboardEvent | ReactKeyboardEvent,
  key: string
) {
  const matches = LATIN_LETTER.test(event.key)
    ? event.key.toLowerCase() === key
    : event.code === `Key${key.toUpperCase()}`;
  return (
    matches &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey
  );
}

export function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      Boolean(target.closest('input, textarea, select')))
  );
}

export function isElementVisible(element: Element | null) {
  return Boolean(
    element && element.isConnected && element.getClientRects().length > 0
  );
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Below this width chat covers the page instead of sitting beside it. */
export function isChatBesidePage() {
  return window.matchMedia('(width >= 768px)').matches;
}

/** Whether a URL leaves this site, so it opens in a new tab. */
export function isExternalUrl(url: string) {
  try {
    return new URL(url, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

function isSavingData() {
  const connection = (
    navigator as { connection?: { saveData?: boolean; effectiveType?: string } }
  ).connection;
  return Boolean(
    connection?.saveData || connection?.effectiveType?.endsWith('2g')
  );
}

/**
 * Runs `preload` once the page has loaded and the browser is idle, so
 * optional code doesn't compete with the page's own. Skipped when the
 * reader saves data or has a slow connection.
 */
export function useIdlePreload(preload: (() => void) | undefined) {
  useEffect(() => {
    // A reader saving data loads search and chat only when about to use them.
    if (!preload || isSavingData()) return;
    let cancelIdle: (() => void) | undefined;
    function schedule() {
      if (typeof requestIdleCallback === 'function') {
        const handle = requestIdleCallback(preload!, {
          timeout: IDLE_PRELOAD_TIMEOUT_MS,
        });
        cancelIdle = () => cancelIdleCallback(handle);
      } else {
        const handle = setTimeout(preload!, 0);
        cancelIdle = () => clearTimeout(handle);
      }
    }
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
    return () => {
      window.removeEventListener('load', schedule);
      cancelIdle?.();
    };
  }, [preload]);
}

/**
 * Sizes an overlay to the visual viewport, so an on-screen keyboard never
 * covers the input or the composer.
 */
export function useVisualViewport(element: HTMLElement | null) {
  useLayoutEffect(() => {
    if (!element) return;
    const viewport = window.visualViewport;
    function reset() {
      element?.style.removeProperty('--docspot-viewport-height');
      element?.style.removeProperty('--docspot-viewport-top');
      element?.removeAttribute('data-viewport-compressed');
    }
    function update() {
      if (viewport && viewport.scale !== 1) {
        reset();
        return;
      }
      element?.toggleAttribute(
        'data-viewport-compressed',
        Boolean(
          viewport &&
          viewport.height < document.documentElement.clientHeight * 0.75
        )
      );
      element?.style.setProperty(
        '--docspot-viewport-height',
        `${viewport?.height ?? window.innerHeight}px`
      );
      element?.style.setProperty(
        '--docspot-viewport-top',
        `${viewport?.offsetTop ?? 0}px`
      );
    }
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      reset();
    };
  }, [element]);
}

/**
 * Keeps what is typed while a field is still loading: printable keys and
 * Backspace edit `text`, starting from its value on mount, and Escape
 * calls `onEscape`.
 */
export function useTypedText(
  text: string,
  onText: (text: string) => void,
  onEscape: () => void
) {
  useLayoutEffect(() => {
    let typed = text;
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onEscape();
        return;
      }
      if (event.key === 'Backspace') typed = typed.slice(0, -1);
      else if (event.key.length === 1) typed += event.key;
      else return;
      event.preventDefault();
      onText(typed);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}

/** Deduplicates a module import and remembers its result once loaded. */
export function createModuleLoader<T>(load: () => Promise<T>) {
  let promise: Promise<T> | undefined;
  let loaded: T | undefined;
  return {
    load() {
      promise ??= load().then(
        module => (loaded = module),
        (error: unknown) => {
          promise = undefined;
          throw error;
        }
      );
      return promise;
    },
    get: () => loaded,
  };
}
