import { type PointerEvent as ReactPointerEvent, useRef } from 'react';

import { useDocspotInternal } from '@/core/context';

import {
  PANEL_DEFAULT_WIDTH,
  PANEL_FLICK_HIDE_DISTANCE,
  PANEL_FLICK_VELOCITY,
  PANEL_HIDE_DISTANCE,
  PANEL_MAX_WIDTH,
  PANEL_MIN_WIDTH,
  type PanelResize,
  clampPanelWidth,
} from '@/core/chatPanelSize';

type PanelDrag = {
  pointerId: number;
  startX: number;
  startWidth: number;
  lastX: number;
  lastTime: number;
  /** In pixels per millisecond, positive toward hiding the panel. */
  velocity: number;
};

type ResizeHandleProps = {
  width: number | undefined;
  onResize: (resize: PanelResize) => void;
  onResizeEnd: (width: number | undefined) => void;
  onHide: () => void;
};

/**
 * Drags or arrow keys resize the docked panel; double-click resets it. Past
 * the minimum width the panel follows the pointer, and releasing far enough,
 * or flicking, hides it.
 */
export function ResizeHandle({
  width,
  onResize,
  onResizeEnd,
  onHide,
}: ResizeHandleProps) {
  const { config } = useDocspotInternal('Docspot.ChatPanel');
  const messages = config.messages.chat;
  const dragRef = useRef<PanelDrag | null>(null);
  const currentWidth = width ?? PANEL_DEFAULT_WIDTH;

  function getResize(drag: PanelDrag, clientX: number): PanelResize {
    const draggedWidth = drag.startWidth + drag.startX - clientX;
    return {
      width: clampPanelWidth(draggedWidth),
      overshoot: Math.max(0, PANEL_MIN_WIDTH - draggedWidth),
    };
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    const { width: nextWidth, overshoot } = getResize(drag, event.clientX);
    // A pause before release is not a flick.
    const isFlick =
      event.type === 'pointerup' &&
      event.timeStamp - drag.lastTime < 100 &&
      drag.velocity > PANEL_FLICK_VELOCITY;
    if (
      overshoot >= PANEL_HIDE_DISTANCE ||
      (isFlick && overshoot >= PANEL_FLICK_HIDE_DISTANCE)
    )
      onHide();
    else onResizeEnd(nextWidth);
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={messages.resize}
      aria-controls={config.chatPanelId}
      aria-valuemin={PANEL_MIN_WIDTH}
      aria-valuemax={PANEL_MAX_WIDTH}
      aria-valuenow={Math.round(currentWidth)}
      aria-valuetext={messages.pixels(Math.round(currentWidth))}
      title={messages.resizeHint}
      tabIndex={0}
      className="docspot-chat-resize"
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startWidth: currentWidth,
          lastX: event.clientX,
          lastTime: event.timeStamp,
          velocity: 0,
        };
      }}
      onPointerMove={event => {
        const drag = dragRef.current;
        if (drag?.pointerId !== event.pointerId) return;
        const elapsed = event.timeStamp - drag.lastTime;
        if (elapsed > 0) {
          drag.velocity = (event.clientX - drag.lastX) / elapsed;
          drag.lastX = event.clientX;
          drag.lastTime = event.timeStamp;
        }
        onResize(getResize(drag, event.clientX));
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => onResizeEnd(undefined)}
      onKeyDown={event => {
        const step = event.shiftKey ? 32 : 16;
        if (event.key === 'ArrowLeft')
          onResizeEnd(clampPanelWidth(currentWidth + step));
        else if (event.key === 'ArrowRight') {
          if (currentWidth <= PANEL_MIN_WIDTH) onHide();
          else onResizeEnd(clampPanelWidth(currentWidth - step));
        } else if (event.key === 'Home') onResizeEnd(PANEL_MIN_WIDTH);
        else if (event.key === 'End') onResizeEnd(PANEL_MAX_WIDTH);
        else return;
        event.preventDefault();
      }}
    />
  );
}
