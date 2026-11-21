import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';

const IDLE_PRELOAD_DELAY_MS = 3_000;
// A page that never idles, such as one running animations, still preloads.
const IDLE_PRELOAD_TIMEOUT_MS = 2_000;

export function isMacPlatform() {
  return (
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)
  );
}

/** Whether this platform labels the command key ⌘, read after hydration. */
export function useIsMac() {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => setIsMac(isMacPlatform()), []);
  return isMac;
}

export function hasModifierKey(event: MouseEvent | KeyboardEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

/** True for Cmd (Mac) or Ctrl (elsewhere) plus `key`, without Alt or Shift. */
export function isCommandKey(
  event: KeyboardEvent | ReactKeyboardEvent,
  key: string
) {
  return (
    event.key.toLowerCase() === key &&
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

/**
 * Runs `preload` once the page has settled and the browser is idle, so
 * optional code doesn't compete with the first render.
 */
export function useIdlePreload(preload: (() => void) | undefined) {
  useEffect(() => {
    if (!preload) return;
    let cancelIdle: (() => void) | undefined;
    const timeout = setTimeout(() => {
      if (typeof requestIdleCallback === 'function') {
        const handle = requestIdleCallback(preload, {
          timeout: IDLE_PRELOAD_TIMEOUT_MS,
        });
        cancelIdle = () => cancelIdleCallback(handle);
      } else {
        const handle = setTimeout(preload, 0);
        cancelIdle = () => clearTimeout(handle);
      }
    }, IDLE_PRELOAD_DELAY_MS);
    return () => {
      clearTimeout(timeout);
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

/** Deduplicates a module import and remembers its result once loaded. */
export function createModuleLoader<T>(load: () => Promise<T>) {
  let promise: Promise<T> | undefined;
  let loaded: T | undefined;
  return {
    load() {
      promise ??= load().then(
        module => (loaded = module),
        error => {
          promise = undefined;
          throw error;
        }
      );
      return promise;
    },
    get: () => loaded,
  };
}
