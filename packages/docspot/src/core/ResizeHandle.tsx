import { useDocspotInternal } from '@/core/context';
import {
  PANEL_DEFAULT_WIDTH,
  PANEL_MAX_WIDTH,
  PANEL_MIN_WIDTH,
  clampPanelWidth,
} from '@/core/chatPanelSize';
import type { HideDirection, PanelGestureEvent } from '@/core/panelGesture';

/** The panel docks at the end of the reading direction, so it hides that way. */
function hideDirection(element: Element): HideDirection {
  return getComputedStyle(element).direction === 'rtl' ? -1 : 1;
}

/** Arrow keys resize by this much; with Shift, twice as much. */
const KEYBOARD_STEP = 16;

type ResizeHandleProps = {
  /** The panel's width, or undefined for the default. */
  width: number | undefined;
  onGesture: (event: PanelGestureEvent) => void;
};

/**
 * Drags or arrow keys resize the docked panel; double-click resets it. Past
 * the minimum width the panel follows the pointer, and releasing far enough,
 * or flicking, hides it. `panelGesture` decides; this reports what happens.
 */
export function ResizeHandle({ width, onGesture }: ResizeHandleProps) {
  const { config } = useDocspotInternal('Docspot.ChatPanel');
  const messages = config.messages.chat;
  const currentWidth = width ?? PANEL_DEFAULT_WIDTH;

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
        onGesture({
          type: 'pointerDown',
          pointerId: event.pointerId,
          x: event.clientX,
          time: event.timeStamp,
          width: currentWidth,
          toward: hideDirection(event.currentTarget),
        });
      }}
      onPointerMove={event =>
        onGesture({
          type: 'pointerMove',
          pointerId: event.pointerId,
          x: event.clientX,
          time: event.timeStamp,
        })
      }
      onPointerUp={event =>
        onGesture({
          type: 'pointerUp',
          pointerId: event.pointerId,
          x: event.clientX,
          time: event.timeStamp,
          cancelled: false,
        })
      }
      onPointerCancel={event =>
        onGesture({
          type: 'pointerUp',
          pointerId: event.pointerId,
          x: event.clientX,
          time: event.timeStamp,
          cancelled: true,
        })
      }
      onDoubleClick={() => onGesture({ type: 'resize', width: undefined })}
      onKeyDown={event => {
        const step = event.shiftKey ? KEYBOARD_STEP * 2 : KEYBOARD_STEP;
        const toward = hideDirection(event.currentTarget);
        // The arrow pointing toward the page widens the panel.
        const [widen, narrow] =
          toward === 1
            ? ['ArrowLeft', 'ArrowRight']
            : ['ArrowRight', 'ArrowLeft'];
        const resize = (next: number) =>
          onGesture({ type: 'resize', width: clampPanelWidth(next) });
        if (event.key === widen) resize(currentWidth + step);
        else if (event.key === narrow) {
          // Holding the key stops at the narrowest; a new press hides.
          if (currentWidth > PANEL_MIN_WIDTH) resize(currentWidth - step);
          else if (!event.repeat) onGesture({ type: 'hide', toward });
        } else if (event.key === 'Home') resize(PANEL_MIN_WIDTH);
        else if (event.key === 'End') resize(PANEL_MAX_WIDTH);
        else return;
        event.preventDefault();
      }}
    />
  );
}
