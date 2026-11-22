import { type ReactElement, type Ref, cloneElement } from 'react';

import { cx } from '@/ui/cx';
import { mergeRefs } from '@/ui/mergeRefs';

/**
 * Replaces the element a part renders, as Base UI's `render` prop does: an
 * element receives the part's props merged into its own, and a function
 * receives the props and the part's state to render whatever it returns.
 */
export type RenderProp<Props, State> =
  ReactElement | ((props: Props, state: State) => ReactElement);

type AnyProps = Record<string, unknown>;

const HANDLER = /^on[A-Z]/;

/**
 * Merges the part's props into the element's own. Both handlers run, the
 * element's first, so it can call `preventDefault` before the part reads
 * it. Classes join, styles merge, and refs both receive the element.
 */
export function mergeProps(ours: AnyProps, theirs: AnyProps): AnyProps {
  const merged: AnyProps = { ...ours, ...theirs };
  for (const [key, own] of Object.entries(ours)) {
    const their = theirs[key];
    if (their === undefined) {
      merged[key] = own;
      continue;
    }
    if (
      HANDLER.test(key) &&
      typeof own === 'function' &&
      typeof their === 'function'
    ) {
      merged[key] = (event: unknown) => {
        (their as (event: unknown) => void)(event);
        (own as (event: unknown) => void)(event);
      };
    } else if (key === 'className')
      merged[key] = cx(own as string, their as string);
    else if (key === 'style')
      merged[key] = { ...(own as object), ...(their as object) };
    else if (key === 'ref')
      merged[key] = mergeRefs(own as Ref<unknown>, their as Ref<unknown>);
  }
  return merged;
}

/**
 * Renders a part with its default element, or with the one `render` asks
 * for.
 */
export function renderElement<Props extends object, State>(
  render: RenderProp<Props, State> | undefined,
  props: Props,
  state: State,
  renderDefault: (props: Props) => ReactElement
): ReactElement {
  if (!render) return renderDefault(props);
  if (typeof render === 'function') return render(props, state);
  return cloneElement(
    render,
    mergeProps(props as AnyProps, render.props as AnyProps)
  );
}
