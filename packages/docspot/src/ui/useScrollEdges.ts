import { useCallback, useEffect, useRef, useState } from 'react';

/** Tracks whether an element can scroll further down, to fade its edge. */
export function useScrollEdges<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [element, setElement] = useState<T | null>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const bind = useCallback((node: T | null) => {
    ref.current = node;
    setElement(node);
  }, []);

  useEffect(() => {
    if (!element) return;
    const target = element;
    function update() {
      setCanScrollDown(
        target.scrollHeight - target.clientHeight - target.scrollTop > 1
      );
    }
    update();
    target.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(target);
    const mutations = new MutationObserver(update);
    mutations.observe(target, { childList: true, subtree: true });
    return () => {
      target.removeEventListener('scroll', update);
      observer.disconnect();
      mutations.disconnect();
    };
  }, [element]);

  return { ref, bind, canScrollDown };
}
