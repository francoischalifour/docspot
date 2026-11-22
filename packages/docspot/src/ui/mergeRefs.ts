import type { Ref, RefCallback } from 'react';

/** Sets every ref to the same element, and clears them on detach. */
export function mergeRefs<T>(
  ...refs: Array<Ref<T> | undefined>
): RefCallback<T> {
  return value => {
    const cleanups = refs.map(ref => {
      if (typeof ref === 'function') {
        const cleanup = ref(value);
        return typeof cleanup === 'function' ? cleanup : () => ref(null);
      }
      if (ref) {
        ref.current = value;
        return () => {
          ref.current = null;
        };
      }
      return undefined;
    });
    return () => cleanups.forEach(cleanup => cleanup?.());
  };
}
