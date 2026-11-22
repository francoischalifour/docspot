// Counts React's work through the DevTools hook, which React calls after
// every commit. Installed before React loads.
const COMPONENT_TAGS = new Set([
  0, // Function
  1, // Class
  11, // ForwardRef
  15, // SimpleMemo
]);

type Fiber = {
  tag: number;
  memoizedProps: unknown;
  memoizedState: unknown;
  child: Fiber | null;
  sibling: Fiber | null;
};

const seen = new WeakSet<object>();
const counts = { commits: 0, renders: 0 };

/**
 * A component rendered in this commit when its props or its hooks are new
 * objects: React reuses both when it skips a component.
 */
function countRenders(root: Fiber) {
  const stack: Fiber[] = [root];
  while (stack.length) {
    const fiber = stack.pop()!;
    if (COMPONENT_TAGS.has(fiber.tag)) {
      const { memoizedProps: props, memoizedState: state } = fiber;
      const isNew = (value: unknown) =>
        typeof value === 'object' && value !== null && !seen.has(value);
      if (isNew(props) || isNew(state)) counts.renders++;
      for (const value of [props, state])
        if (typeof value === 'object' && value !== null) seen.add(value);
    }
    if (fiber.sibling) stack.push(fiber.sibling);
    if (fiber.child) stack.push(fiber.child);
  }
}

Object.assign(window, {
  __REACT_DEVTOOLS_GLOBAL_HOOK__: {
    isDisabled: false,
    supportsFiber: true,
    renderers: new Map(),
    inject: () => 1,
    onCommitFiberRoot(_id: number, root: { current: Fiber }) {
      counts.commits++;
      countRenders(root.current);
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    checkDCE() {},
  },
  docspotBench: {
    reset() {
      counts.commits = 0;
      counts.renders = 0;
    },
    read: () => ({ ...counts }),
  },
});
