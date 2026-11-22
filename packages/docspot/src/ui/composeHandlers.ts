/** Runs the consumer's handler, then Docspot's own. */
export function composeHandlers<E>(
  own: (event: E) => void,
  theirs: ((event: E) => void) | undefined
) {
  return (event: E) => {
    theirs?.(event);
    own(event);
  };
}
