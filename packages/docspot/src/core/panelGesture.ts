import {
  PANEL_FLICK_HIDE_DISTANCE,
  PANEL_FLICK_VELOCITY,
  PANEL_HIDE_DISTANCE,
  PANEL_MIN_WIDTH,
  type PanelResize,
  clampPanelWidth,
} from '@/core/chatPanelSize';

/** A pause this long before releasing is not a flick. */
const FLICK_MAX_PAUSE_MS = 100;

type PanelDrag = {
  pointerId: number;
  startX: number;
  startWidth: number;
  lastX: number;
  lastTime: number;
  /** In pixels per millisecond, positive toward hiding the panel. */
  velocity: number;
};

/**
 * Resizing the docked chat panel. A drag ends by settling at a width or by
 * hiding the panel; both animate before they apply, keeping the size the
 * panel had when released.
 */
export type PanelGesture =
  | { status: 'idle' }
  | { status: 'dragging'; drag: PanelDrag; resize: PanelResize }
  | {
      status: 'settling';
      resize: PanelResize | null;
      /** The width to save once settled; undefined resets it. */
      width: number | undefined;
    }
  | { status: 'hiding'; resize: PanelResize | null };

type PointerPosition = { pointerId: number; x: number; time: number };

export type PanelGestureEvent =
  | ({ type: 'pointerDown'; width: number } & PointerPosition)
  | ({ type: 'pointerMove' } & PointerPosition)
  | ({ type: 'pointerUp'; cancelled: boolean } & PointerPosition)
  /** Resizes without a drag, from the keyboard or a double click. */
  | { type: 'resize'; width: number | undefined }
  /** Hides without a drag, from the keyboard. */
  | { type: 'hide' }
  /** The settling or hiding animation finished. */
  | { type: 'settled' };

export const idleGesture: PanelGesture = { status: 'idle' };

function getResize(drag: PanelDrag, x: number): PanelResize {
  const draggedWidth = drag.startWidth + drag.startX - x;
  return {
    width: clampPanelWidth(draggedWidth),
    overshoot: Math.max(0, PANEL_MIN_WIDTH - draggedWidth),
  };
}

/** Pure transitions. Returns the same state when nothing changes. */
export function panelGesture(
  state: PanelGesture,
  event: PanelGestureEvent
): PanelGesture {
  switch (event.type) {
    case 'pointerDown': {
      // A new drag may interrupt the panel settling, not hiding.
      if (state.status === 'dragging' || state.status === 'hiding')
        return state;
      const drag: PanelDrag = {
        pointerId: event.pointerId,
        startX: event.x,
        startWidth: event.width,
        lastX: event.x,
        lastTime: event.time,
        velocity: 0,
      };
      return { status: 'dragging', drag, resize: getResize(drag, event.x) };
    }
    case 'pointerMove': {
      if (state.status !== 'dragging') return state;
      const { drag } = state;
      if (drag.pointerId !== event.pointerId) return state;
      const elapsed = event.time - drag.lastTime;
      const next =
        elapsed > 0
          ? {
              ...drag,
              velocity: (event.x - drag.lastX) / elapsed,
              lastX: event.x,
              lastTime: event.time,
            }
          : drag;
      return {
        status: 'dragging',
        drag: next,
        resize: getResize(next, event.x),
      };
    }
    case 'pointerUp': {
      if (state.status !== 'dragging') return state;
      const { drag } = state;
      if (drag.pointerId !== event.pointerId) return state;
      const resize = getResize(drag, event.x);
      const isFlick =
        !event.cancelled &&
        event.time - drag.lastTime < FLICK_MAX_PAUSE_MS &&
        drag.velocity > PANEL_FLICK_VELOCITY;
      const hides =
        resize.overshoot >= PANEL_HIDE_DISTANCE ||
        (isFlick && resize.overshoot >= PANEL_FLICK_HIDE_DISTANCE);
      return hides
        ? { status: 'hiding', resize }
        : { status: 'settling', resize, width: resize.width };
    }
    case 'resize':
      return state.status === 'idle'
        ? { status: 'settling', resize: null, width: event.width }
        : state;
    case 'hide':
      return state.status === 'idle'
        ? { status: 'hiding', resize: null }
        : state;
    case 'settled':
      return state.status === 'settling' || state.status === 'hiding'
        ? idleGesture
        : state;
  }
}

/** The size the panel shows during the gesture, if it differs from saved. */
export function gestureResize(state: PanelGesture): PanelResize | null {
  return state.status === 'idle' ? null : state.resize;
}
