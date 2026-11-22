import { type ComponentProps, use, useLayoutEffect, useRef } from 'react';

import { ScrollerContext } from '@/chat/ScrollerContext';

type ReadingAnchorProps = ComponentProps<'div'> & { active: boolean };

export function ReadingAnchor({ active, ...props }: ReadingAnchorProps) {
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
